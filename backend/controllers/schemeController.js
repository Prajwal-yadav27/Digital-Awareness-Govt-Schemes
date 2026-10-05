const Scheme = require('../models/Scheme');
const User = require('../models/User');
const Bookmark = require('../models/Bookmark');
const { SOURCE_TYPES, SOURCE_TYPES_DISPLAY, ELIGIBILITY_TAGS, INDIAN_STATES, CATEGORY_SUGGESTIONS } = require('../constants/schemeConstants');

// Apply tracking is intentionally rate-limited separately from general API
// traffic. One visitor may record one apply action for a scheme per minute.
const APPLY_COOLDOWN_MS = 60 * 1000;
const applyRequestTimes = new Map();
const MAX_SEARCH_LENGTH = 100;
const MAX_FILTER_LENGTH = 80;
const MAX_PAGE_LIMIT = 10000;
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'category', 'applyCount']);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readQueryString = (value, name, maxLength) => {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') {
    const error = new Error(`${name} must be a string`);
    error.statusCode = 400;
    throw error;
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    const error = new Error(`${name} cannot exceed ${maxLength} characters`);
    error.statusCode = 400;
    throw error;
  }
  return trimmed;
};

const normalizeSourceType = (value) => {
  if (value === undefined || value === null) return 'CENTRAL';
  const raw = String(value).trim();
  if (!raw) return 'CENTRAL';
  const upper = raw.toUpperCase();
  if (SOURCE_TYPES.includes(upper)) return upper;
  if (upper.includes('CENTRAL')) return 'CENTRAL';
  if (upper.includes('STATE')) return 'STATE';
  if (SOURCE_TYPES_DISPLAY.some(label => label.toUpperCase() === upper)) {
    return upper.includes('CENTRAL') ? 'CENTRAL' : 'STATE';
  }
  return raw;
};

const isAllowedSourceType = (value) => {
  const normalized = normalizeSourceType(value);
  return SOURCE_TYPES.includes(normalized);
};

const getApplyRateLimitKey = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${ip}:${req.params.id}`;
};

const clearExpiredApplyRateLimits = (now) => {
  for (const [key, timestamp] of applyRequestTimes) {
    if (now - timestamp >= APPLY_COOLDOWN_MS) applyRequestTimes.delete(key);
  }
};

const extractValidationErrors = (err) => {
  if (err.name !== 'ValidationError') return null;
  const errors = {};
  for (const field in err.errors) {
    errors[field] = err.errors[field].message;
  }
  return {
    message: Object.values(errors)[0] || 'Validation failed',
    errors
  };
};

const isDuplicateKeyError = (err) => {
  return err.code === 11000 && err.keyPattern?.title && err.keyPattern?.category;
};

const sanitizeTags = (arr, allowed) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  return arr
    .map(v => typeof v === 'string' ? v.trim() : '')
    .filter(v => v && allowed.includes(v) && !(seen.has(v)) && seen.add(v));
};

const sanitizeDocList = (arr) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  return arr
    .map(v => typeof v === 'string' ? v.trim() : '')
    .filter(v => v && !(seen.has(v)) && seen.add(v))
    .slice(0, 30);
};

// A scheme is expired when it has an endDate in the past.
// Comparison uses Date objects (UTC instants) server-side; never formatted strings.
const isSchemeExpired = (scheme, now = new Date()) => {
  if (!scheme || !scheme.endDate) return false;
  const end = scheme.endDate instanceof Date ? scheme.endDate : new Date(scheme.endDate);
  if (isNaN(end.getTime())) return false;
  return end.getTime() < now.getTime();
};

// Normalizes the optional endDate body value: ''/null/undefined -> null (cleared),
// valid date string/Date -> Date, anything else -> throws 400-style error.
const parseEndDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (isNaN(parsed.getTime())) {
    const error = new Error('endDate must be a valid date');
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

const getSchemeMetadata = async (_req, res) => {
  try {
    const storedCategories = await Scheme.distinct('category');
    const categories = [...new Set([
      ...CATEGORY_SUGGESTIONS,
      ...storedCategories.filter(Boolean)
    ])].sort((a, b) => a.localeCompare(b));

    res.json({
      success: true,
      message: 'Scheme metadata retrieved',
      data: {
        sourceTypes: SOURCE_TYPES_DISPLAY,
        eligibilityTags: ELIGIBILITY_TAGS,
        states: INDIAN_STATES,
        categories
      }
    });
  } catch (err) {
    console.error('Metadata error:', err);
    res.status(500).json({ success: false, message: 'Failed to load metadata' });
  }
};

const createScheme = async (req, res) => {
  try {
    const {
      title, description, category, eligibility, benefits,
      sourceType, state, officialURL, imageUrl, status, eligibilityTags, documentsRequired, eligibilityRules, endDate
    } = req.body;

    const parsedEndDate = parseEndDate(endDate);
    const trimmedTitle = title?.trim();
    const trimmedCategory = category?.trim();
    const trimmedDescription = description?.trim();
    const trimmedEligibility = eligibility?.trim();
    const trimmedBenefits = benefits?.trim();
    const normalizedSourceType = normalizeSourceType(sourceType);
    if (!isAllowedSourceType(normalizedSourceType)) {
      return res.status(400).json({
        success: false,
        message: `sourceType must be one of: ${SOURCE_TYPES.join(', ')}`
      });
    }
    const trimmedState = normalizedSourceType === 'STATE' && typeof state === 'string' ? state.trim() : '';
    const trimmedOfficialURL = officialURL?.trim() || '';
    const trimmedImageUrl = imageUrl?.trim() || '';
    const normalizedStatus = status && ['Active', 'Inactive', 'Draft'].includes(String(status).trim()) ? String(status).trim() : 'Active';
    const cleanTags = sanitizeTags(eligibilityTags, ELIGIBILITY_TAGS);
    const cleanDocs = sanitizeDocList(documentsRequired);

    if (!trimmedTitle || !trimmedDescription || !trimmedCategory || !trimmedEligibility || !trimmedBenefits) {
      const missing = [];
      if (!trimmedTitle) missing.push('title');
      if (!trimmedDescription) missing.push('description');
      if (!trimmedCategory) missing.push('category');
      if (!trimmedEligibility) missing.push('eligibility');
      if (!trimmedBenefits) missing.push('benefits');

      return res.status(400).json({
        success: false,
        message: `All required fields are missing: ${missing.join(', ')}`,
        errors: missing.reduce((acc, f) => {
          acc[f] = `${f.charAt(0).toUpperCase() + f.slice(1)} is required`;
          return acc;
        }, {})
      });
    }

    if (normalizedSourceType === 'STATE' && !trimmedState) {
      return res.status(400).json({
        success: false,
        message: 'State is required for State Govt schemes',
        errors: { state: 'State is required for State Govt schemes' }
      });
    }

    const newScheme = new Scheme({
      title: trimmedTitle,
      description: trimmedDescription,
      category: trimmedCategory,
      eligibility: trimmedEligibility,
      benefits: trimmedBenefits,
      sourceType: normalizedSourceType,
      state: trimmedState,
      officialURL: trimmedOfficialURL,
      imageUrl: trimmedImageUrl,
      status: normalizedStatus,
      eligibilityTags: cleanTags,
      documentsRequired: cleanDocs,
      eligibilityRules,
      endDate: parsedEndDate,
      applyCount: 0,
      createdBy: req.user?._id || null
    });

    const savedScheme = await newScheme.save();
    await savedScheme.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Scheme created successfully',
      data: savedScheme
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (isDuplicateKeyError(err)) {
      return res.status(400).json({
        success: false,
        message: 'A scheme with this title already exists in this category'
      });
    }

    const validation = extractValidationErrors(err);
    if (validation) {
      return res.status(400).json({
        success: false,
        ...validation
      });
    }

    console.error('Create scheme error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error creating scheme. Please try again.'
    });
  }
};

const normalizeSourceForQuery = (value) => {
  if (!value) return '';
  const normalized = normalizeSourceType(value);
  return SOURCE_TYPES.includes(normalized) ? normalized : value;
};

const getSchemes = async (req, res) => {
  try {
    const {
      search, category, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc',
      sourceType, state, eligibility
    } = req.query;
    const query = {};

    const safeSearch = readQueryString(search, 'search', MAX_SEARCH_LENGTH);
    const safeCategory = readQueryString(category, 'category', MAX_FILTER_LENGTH);
    const safeState = readQueryString(state, 'state', MAX_FILTER_LENGTH);
    const rawSourceType = readQueryString(sourceType, 'sourceType', MAX_FILTER_LENGTH);
    const safeSourceType = normalizeSourceForQuery(rawSourceType);
    const safeSortBy = readQueryString(sortBy, 'sortBy', 30) || 'createdAt';
    const safeSortOrder = readQueryString(sortOrder, 'sortOrder', 4) || 'desc';

    if (!ALLOWED_SORT_FIELDS.has(safeSortBy)) {
      return res.status(400).json({ success: false, message: 'Invalid sort field' });
    }
    if (!['asc', 'desc'].includes(safeSortOrder)) {
      return res.status(400).json({ success: false, message: 'sortOrder must be asc or desc' });
    }
    if (safeSourceType && !SOURCE_TYPES.includes(safeSourceType)) {
      return res.status(400).json({
        success: false,
        message: `sourceType must be one of: ${SOURCE_TYPES.join(', ')}`
      });
    }

    if (safeSearch) {
      const escapedSearch = escapeRegex(safeSearch);
      query.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { category: { $regex: escapedSearch, $options: 'i' } },
        { eligibility: { $regex: escapedSearch, $options: 'i' } },
        { benefits: { $regex: escapedSearch, $options: 'i' } },
        { state: { $regex: escapedSearch, $options: 'i' } },
        { 'eligibilityTags': { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    if (safeCategory) {
      query.category = { $regex: escapeRegex(safeCategory), $options: 'i' };
    }
    if (safeSourceType) {
      query.sourceType = safeSourceType;
    }
    if (safeState) {
      query.state = { $regex: escapeRegex(safeState), $options: 'i' };
    }
    if (eligibility) {
      if (typeof eligibility === 'string' && eligibility.length > 1000) {
        return res.status(400).json({ success: false, message: 'eligibility cannot exceed 1000 characters' });
      }
      const tags = typeof eligibility === 'string'
        ? eligibility.split(',').map(s => s.trim()).filter(Boolean)
        : Array.isArray(eligibility) ? eligibility.filter(Boolean) : [];
      if (tags.length > ELIGIBILITY_TAGS.length || tags.some(tag => typeof tag !== 'string' || tag.length > MAX_FILTER_LENGTH)) {
        return res.status(400).json({ success: false, message: 'Invalid eligibility filter' });
      }
      if (tags.length) {
        query.eligibilityTags = { $all: tags };
      }
    }

    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const sortOptions = {};
    sortOptions[safeSortBy] = safeSortOrder === 'asc' ? 1 : -1;

    const schemes = await Scheme.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const total = await Scheme.countDocuments(query);

    const schemesWithVirtuals = schemes.map((s) => ({
      ...s,
      formattedCreatedAt: s.createdAt
        ? new Date(s.createdAt).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : null,
      formattedUpdatedAt: s.updatedAt
        ? new Date(s.updatedAt).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : null
    }));

    res.json({
      success: true,
      message: 'Schemes retrieved successfully',
      data: schemesWithVirtuals,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        pages: Math.ceil(total / safeLimit),
        hasNext: safePage < Math.ceil(total / safeLimit),
        hasPrev: safePage > 1
      }
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Get schemes error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching schemes. Please try again.'
    });
  }
};

const getSchemeById = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id)
      .populate('createdBy', 'name email role');

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Scheme not found'
      });
    }

    res.json({
      success: true,
      message: 'Scheme retrieved successfully',
      data: scheme
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheme ID format'
      });
    }

    console.error('Get scheme error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching scheme. Please try again.'
    });
  }
};

const recordApplyNow = async (req, res) => {
  const now = Date.now();
  clearExpiredApplyRateLimits(now);

  const rateLimitKey = getApplyRateLimitKey(req);
  const previousRequest = applyRequestTimes.get(rateLimitKey);
  if (previousRequest) {
    const retryAfterSeconds = Math.ceil((APPLY_COOLDOWN_MS - (now - previousRequest)) / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      message: 'Apply action was already recorded recently. Please try again later.',
      retryAfterSeconds
    });
  }

  applyRequestTimes.set(rateLimitKey, now);

  try {
    const existing = await Scheme.findById(req.params.id).select('_id endDate status');

    if (!existing) {
      applyRequestTimes.delete(rateLimitKey);
      return res.status(404).json({
        success: false,
        message: 'Scheme not found'
      });
    }

    if (isSchemeExpired(existing, new Date(now))) {
      applyRequestTimes.delete(rateLimitKey);
      return res.status(400).json({
        success: false,
        message: 'This scheme has expired and is no longer accepting applications.'
      });
    }

    const scheme = await Scheme.findByIdAndUpdate(
      req.params.id,
      { $inc: { applyCount: 1 } },
      { new: true, runValidators: true }
    );

    if (!scheme) {
      applyRequestTimes.delete(rateLimitKey);
      return res.status(404).json({
        success: false,
        message: 'Scheme not found'
      });
    }

    res.json({
      success: true,
      message: 'Apply Now recorded',
      data: {
        applyCount: scheme.applyCount,
        _id: scheme._id
      }
    });
  } catch (err) {
    applyRequestTimes.delete(rateLimitKey);
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid scheme ID' });
    }
    console.error('recordApplyNow error:', err);
    res.status(500).json({ success: false, message: 'Failed to record Apply Now' });
  }
};

const updateScheme = async (req, res) => {
  try {
    const {
      title, description, category, eligibility, benefits,
      sourceType, state, officialURL, imageUrl, status, eligibilityTags, documentsRequired, eligibilityRules, endDate
    } = req.body;

    const scheme = await Scheme.findById(req.params.id);
    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Scheme not found'
      });
    }

    if (title !== undefined) {
      const trimmed = title.trim();
      if (trimmed.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Title must be at least 3 characters'
        });
      }
      scheme.title = trimmed;
    }
    if (description !== undefined) {
      const trimmed = description.trim();
      if (trimmed.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Description must be at least 10 characters'
        });
      }
      scheme.description = trimmed;
    }
    if (category !== undefined) {
      const trimmed = category.trim();
      if (trimmed.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Category must be at least 2 characters'
        });
      }
      scheme.category = trimmed;
    }
    if (eligibility !== undefined) {
      const trimmed = eligibility.trim();
      if (trimmed.length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Eligibility must be at least 5 characters'
        });
      }
      scheme.eligibility = trimmed;
    }
    if (benefits !== undefined) {
      const trimmed = benefits.trim();
      if (trimmed.length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Benefits must be at least 5 characters'
        });
      }
      scheme.benefits = trimmed;
    }
    if (sourceType !== undefined) {
      const normalized = normalizeSourceType(sourceType);
      if (!SOURCE_TYPES.includes(normalized)) {
        return res.status(400).json({
          success: false,
          message: `sourceType must be one of: ${SOURCE_TYPES.join(', ')}`
        });
      }
      scheme.sourceType = normalized;
    }
    if (state !== undefined) {
      scheme.state = typeof state === 'string' ? state.trim() : '';
    }
    if (officialURL !== undefined) {
      scheme.officialURL = typeof officialURL === 'string' ? officialURL.trim() : '';
    }
    if (imageUrl !== undefined) {
      scheme.imageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    }
    if (status !== undefined) {
      const normalized = String(status).trim();
      if (['Active', 'Inactive', 'Draft'].includes(normalized)) {
        scheme.status = normalized;
      }
    }
    if (eligibilityTags !== undefined) {
      scheme.eligibilityTags = sanitizeTags(eligibilityTags, ELIGIBILITY_TAGS);
    }
    if (documentsRequired !== undefined) {
      scheme.documentsRequired = sanitizeDocList(documentsRequired);
    }
    if (eligibilityRules !== undefined) {
      scheme.eligibilityRules = eligibilityRules;
    }
    if (endDate !== undefined) {
      scheme.endDate = parseEndDate(endDate);
      // Re-arm expiry notifications if the admin moves the end date back to the future
      if (scheme.endDate && scheme.endDate.getTime() >= Date.now()) {
        scheme.expiryNotifiedAt = null;
        scheme.deadlineNotifiedAt = null;
      }
    }

    if (scheme.sourceType === 'STATE') {
      if (!scheme.state) {
        return res.status(400).json({
          success: false,
          message: 'State is required for State Govt schemes',
          errors: { state: 'State is required for State Govt schemes' }
        });
      }
    } else {
      scheme.state = '';
    }

    const updatedScheme = await scheme.save();
    await updatedScheme.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Scheme updated successfully',
      data: updatedScheme
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheme ID format'
      });
    }

    if (isDuplicateKeyError(err)) {
      return res.status(400).json({
        success: false,
        message: 'A scheme with this title already exists in this category'
      });
    }

    const validation = extractValidationErrors(err);
    if (validation) {
      return res.status(400).json({
        success: false,
        ...validation
      });
    }

    console.error('Update scheme error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating scheme. Please try again.'
    });
  }
};

const bulkCreateSchemes = async (req, res) => {
  try {
    const schemes = req.body;

    if (!Array.isArray(schemes)) {
      return res.status(400).json({
        success: false,
        message: 'Request body must be a JSON array of schemes'
      });
    }
    if (schemes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array must contain at least one scheme'
      });
    }
    if (schemes.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Bulk limit is 200 schemes per request'
      });
    }

    let inserted = 0;
    let skippedDuplicates = 0;
    let failed = 0;
    const insertedIds = [];
    const duplicates = [];
    const errors = [];
    const seenInBatch = new Set();

    for (let index = 0; index < schemes.length; index++) {
      const raw = schemes[index];
      try {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          failed++;
          errors.push({ index, title: raw?.title || null, category: raw?.category || null, message: 'Invalid scheme object', errors: { _self: 'Must be an object' } });
          continue;
        }

        const {
          title, description, category, eligibility, benefits,
          sourceType, state, officialURL, imageUrl, status, eligibilityTags, documentsRequired, eligibilityRules
        } = raw;

        const trimmedTitle = typeof title === 'string' ? title.trim() : '';
        const trimmedCategory = typeof category === 'string' ? category.trim() : '';
        const trimmedDescription = typeof description === 'string' ? description.trim() : '';
        const trimmedEligibility = typeof eligibility === 'string' ? eligibility.trim() : '';
        const trimmedBenefits = typeof benefits === 'string' ? benefits.trim() : '';
        const normalizedSourceType = normalizeSourceType(sourceType);
        if (!isAllowedSourceType(normalizedSourceType)) {
          failed++;
          errors.push({ index, title: trimmedTitle || null, category: trimmedCategory || null, message: `sourceType must be one of: ${SOURCE_TYPES.join(', ')}`, errors: { sourceType: `sourceType must be one of: ${SOURCE_TYPES.join(', ')}` } });
          continue;
        }
        const trimmedState = normalizedSourceType === 'STATE' && typeof state === 'string' ? state.trim() : '';
        const trimmedOfficialURL = typeof officialURL === 'string' ? officialURL.trim() : '';
        const trimmedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
        const normalizedStatus = status && ['Active', 'Inactive', 'Draft'].includes(String(status).trim()) ? String(status).trim() : 'Active';
        const cleanTags = sanitizeTags(eligibilityTags, ELIGIBILITY_TAGS);
        const cleanDocs = sanitizeDocList(documentsRequired);

        if (!trimmedTitle || !trimmedDescription || !trimmedCategory || !trimmedEligibility || !trimmedBenefits) {
          const missing = [];
          if (!trimmedTitle) missing.push('title');
          if (!trimmedDescription) missing.push('description');
          if (!trimmedCategory) missing.push('category');
          if (!trimmedEligibility) missing.push('eligibility');
          if (!trimmedBenefits) missing.push('benefits');
          failed++;
          errors.push({
            index,
            title: trimmedTitle || null,
            category: trimmedCategory || null,
            message: `Missing required fields: ${missing.join(', ')}`,
            errors: missing.reduce((acc, f) => { acc[f] = `${f} is required`; return acc; }, {})
          });
          continue;
        }

        if (normalizedSourceType === 'STATE' && !trimmedState) {
          failed++;
          errors.push({ index, title: trimmedTitle, category: trimmedCategory, message: 'State is required for State Govt schemes', errors: { state: 'State is required for State Govt schemes' } });
          continue;
        }

        const duplicateKey = `${trimmedTitle.toLowerCase()}::${trimmedCategory.toLowerCase()}`;
        if (seenInBatch.has(duplicateKey)) {
          skippedDuplicates++;
          duplicates.push({ index, title: trimmedTitle, category: trimmedCategory, reason: 'Duplicate title+category within batch' });
          continue;
        }
        seenInBatch.add(duplicateKey);

        const exists = await Scheme.findOne({ title: trimmedTitle, category: trimmedCategory }).select('_id').lean();
        if (exists) {
          skippedDuplicates++;
          duplicates.push({ index, title: trimmedTitle, category: trimmedCategory, reason: 'A scheme with this title already exists in this category' });
          continue;
        }

        const newScheme = new Scheme({
          title: trimmedTitle,
          description: trimmedDescription,
          category: trimmedCategory,
          eligibility: trimmedEligibility,
          benefits: trimmedBenefits,
          sourceType: normalizedSourceType,
          state: trimmedState,
          officialURL: trimmedOfficialURL,
          imageUrl: trimmedImageUrl,
          status: normalizedStatus,
          eligibilityTags: cleanTags,
          documentsRequired: cleanDocs, // preserved field name
          eligibilityRules,
          applyCount: 0,
          createdBy: req.user?._id || null
        });

        const saved = await newScheme.save();
        inserted++;
        insertedIds.push(saved._id);
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          skippedDuplicates++;
          const rawItem = schemes[index];
          duplicates.push({
            index,
            title: typeof rawItem?.title === 'string' ? rawItem.title.trim() : null,
            category: typeof rawItem?.category === 'string' ? rawItem.category.trim() : null,
            reason: 'A scheme with this title already exists in this category'
          });
          continue;
        }
        const validation = extractValidationErrors(err);
        if (validation) {
          failed++;
          const rawItem = schemes[index];
          errors.push({
            index,
            title: typeof rawItem?.title === 'string' ? rawItem.title.trim() : null,
            category: typeof rawItem?.category === 'string' ? rawItem.category.trim() : null,
            message: validation.message,
            errors: validation.errors
          });
          continue;
        }
        failed++;
        const rawItem = schemes[index];
        errors.push({
          index,
          title: typeof rawItem?.title === 'string' ? rawItem.title.trim() : null,
          category: typeof rawItem?.category === 'string' ? rawItem.category.trim() : null,
          message: err.message || 'Server error',
          errors: { _self: err.message }
        });
      }
    }

    return res.status(inserted > 0 ? 201 : 200).json({
      success: true,
      message: `Bulk import completed: ${inserted} inserted, ${skippedDuplicates} duplicates skipped, ${failed} failed`,
      data: {
        totalReceived: schemes.length,
        inserted,
        skippedDuplicates,
        failed,
        insertedIds,
        duplicates,
        errors
      }
    });
  } catch (err) {
    console.error('Bulk create schemes error:', err);
    return res.status(500).json({ success: false, message: 'Server error during bulk import' });
  }
};

const deleteScheme = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);
    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Scheme not found'
      });
    }

    await Scheme.findByIdAndDelete(req.params.id);
    await User.updateMany(
      { bookmarks: scheme._id },
      { $pull: { bookmarks: scheme._id } }
    );
    await Bookmark.deleteMany({ scheme: scheme._id });

    res.json({
      success: true,
      message: 'Scheme deleted successfully'
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheme ID format'
      });
    }

    console.error('Delete scheme error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error deleting scheme. Please try again.'
    });
  }
};

module.exports = {
  createScheme,
  bulkCreateSchemes,
  getSchemes,
  getSchemeById,
  updateScheme,
  deleteScheme,
  getSchemeMetadata,
  recordApplyNow,
  isSchemeExpired
};
