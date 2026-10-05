const Event = require('../models/Event');
const User = require('../models/User');
const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const { 
  sendEventApprovedNotification, 
  sendEventRejectedNotification, 
  sendEventUpdatedNotification,
  sendEventCancelledNotification,
  sendEventRegistrationNotification,
  sendRegistrationConfirmedNotification,
  sendRegistrationRejectedNotification,
  sendRegistrationCancelledNotification,
  sendEventReminderNotification
} = require('../utils/notificationService');

const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'category', 'eventDate', 'capacity', 'registrationCount', 'viewCount']);
const MAX_SEARCH_LENGTH = 100;
const MAX_FILTER_LENGTH = 80;
const ALLOWED_SOURCE_TYPES = ['Central', 'State', 'Local'];
const ALLOWED_EVENT_FORMATS = ['offline', 'online', 'hybrid'];

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

const sanitizeDocList = (arr) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  return arr
    .map(v => typeof v === 'string' ? v.trim() : '')
    .filter(v => v && !(seen.has(v)) && seen.add(v))
    .slice(0, 30);
};

// Helper to optionally get user from token for public routes
const getOptionalUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    return user;
  } catch (_) {
    return null;
  }
};

const createEvent = async (req, res) => {
  try {
    const {
      title, description, category, location, eventDate, registrationDeadline,
      capacity, status, imageUrl, eligibility, benefits, documentsRequired,
      registrationFee: rawFee, isPaidEvent: rawIsPaid,
      department, schemeId, sourceType, eventFormat, targetAudience,
      ward, district, state, contactInfo
    } = req.body;
    const registrationFee = rawFee !== undefined && rawFee !== null && Number(rawFee) > 0 ? Number(rawFee) : 0;
    const isPaidEvent = !!rawIsPaid && registrationFee > 0;

    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    const trimmedDescription = typeof description === 'string' ? description.trim() : '';
    const trimmedCategory = typeof category === 'string' ? category.trim() : '';
    const trimmedLocation = typeof location === 'string' ? location.trim() : '';
    const trimmedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    const trimmedEligibility = typeof eligibility === 'string' ? eligibility.trim() : '';
    const trimmedBenefits = typeof benefits === 'string' ? benefits.trim() : '';

    if (!trimmedTitle || !trimmedDescription || !trimmedCategory) {
      const missing = [];
      if (!trimmedTitle) missing.push('title');
      if (!trimmedDescription) missing.push('description');
      if (!trimmedCategory) missing.push('category');
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
        errors: missing.reduce((acc, f) => { acc[f] = `${f} is required`; return acc; }, {})
      });
    }
    if (trimmedTitle.length < 3) {
      return res.status(400).json({ success: false, message: 'Title must be at least 3 characters' });
    }
    if (trimmedDescription.length < 10) {
      return res.status(400).json({ success: false, message: 'Description must be at least 10 characters' });
    }
    if (trimmedCategory.length < 2) {
      return res.status(400).json({ success: false, message: 'Category must be at least 2 characters' });
    }

    if (!eventDate) {
      return res.status(400).json({ success: false, message: 'Event date is required' });
    }
    const parsedEventDate = new Date(eventDate);
    if (isNaN(parsedEventDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid eventDate' });
    }

    let parsedDeadline = null;
    if (registrationDeadline !== undefined && registrationDeadline !== null && registrationDeadline !== '') {
      parsedDeadline = new Date(registrationDeadline);
      if (isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid registrationDeadline' });
      }
      if (parsedDeadline > parsedEventDate) {
        return res.status(400).json({ success: false, message: 'registrationDeadline cannot be after eventDate' });
      }
    }

    if (capacity !== undefined && capacity !== null && capacity !== '') {
      const capNum = Number(capacity);
      if (isNaN(capNum) || !Number.isInteger(capNum) || capNum < 1 || capNum > 10000) {
        return res.status(400).json({ success: false, message: 'Capacity must be an integer between 1 and 10000' });
      }
    }

    if (trimmedImageUrl && !/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i.test(trimmedImageUrl)) {
      return res.status(400).json({ success: false, message: 'Image URL must be a valid URL starting with http:// or https://' });
    }

    const cleanDocs = sanitizeDocList(documentsRequired);

    let organizerId;
    let finalStatus = 'Pending';

    if (req.user.role === 'organizer') {
      organizerId = req.user._id;
      finalStatus = 'Pending';
    } else if (req.user.role === 'admin') {
      if (req.body.organizer) {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(req.body.organizer)) {
          return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
        }
        const orgUser = await User.findById(req.body.organizer);
        if (!orgUser) {
          return res.status(404).json({ success: false, message: 'Organizer user not found' });
        }
        if (orgUser.role !== 'organizer' && orgUser.role !== 'admin') {
          return res.status(400).json({ success: false, message: 'User is not an organizer' });
        }
        organizerId = orgUser._id;
      } else {
        organizerId = req.user._id;
      }
      if (status && ['Pending', 'Approved', 'Rejected', 'Draft'].includes(String(status).trim())) {
        finalStatus = String(status).trim();
      }
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized to create events' });
    }

    const newEvent = new Event({
      title: trimmedTitle,
      description: trimmedDescription,
      category: trimmedCategory,
      organizer: organizerId,
      location: trimmedLocation,
      eventDate: parsedEventDate,
      registrationDeadline: parsedDeadline,
      capacity: capacity !== undefined && capacity !== '' ? Number(capacity) : undefined,
      status: finalStatus,
      imageUrl: trimmedImageUrl,
      eligibility: trimmedEligibility,
      benefits: trimmedBenefits,
      documentsRequired: cleanDocs,
      registrationFee: isPaidEvent ? registrationFee : 0,
      isPaidEvent,
      createdBy: req.user._id,
      department: typeof department === 'string' ? department.trim() : '',
      schemeId: schemeId || null,
      sourceType: sourceType || 'Local',
      eventFormat: eventFormat || 'offline',
      targetAudience: Array.isArray(targetAudience) ? targetAudience.filter(a => typeof a === 'string' && a.trim()).map(a => a.trim()).slice(0, 20) : [],
      ward: typeof ward === 'string' ? ward.trim() : '',
      district: typeof district === 'string' ? district.trim() : '',
      state: typeof state === 'string' ? state.trim() : '',
      contactInfo: typeof contactInfo === 'string' ? contactInfo.trim() : ''
    });

    const saved = await newEvent.save();
    await saved.populate('organizer', 'name email organizationName');
    await saved.populate('createdBy', 'name email');

    // Notify admins when an organizer submits a new event for approval.
    if (finalStatus === 'Pending' && req.user.role === 'organizer') {
      try {
        const adminUsers = await User.find({ role: 'admin' }).select('_id').lean();
        const orgName = saved.organizer?.name || req.user.name || 'Organizer';
        for (const admin of adminUsers) {
          await sendEventPendingNotification(admin._id, saved.title, orgName).catch(() => {});
        }
      } catch (e) {
        console.warn('Failed to notify admin of pending event:', e.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: saved
    });
  } catch (err) {
    const validation = extractValidationErrors(err);
    if (validation) {
      return res.status(400).json({ success: false, ...validation });
    }
    console.error('Create event error:', err);
    res.status(500).json({ success: false, message: 'Server error creating event. Please try again.' });
  }
};

const getEvents = async (req, res) => {
  try {
    const {
      search, category, status, organizer,
      sourceType, eventFormat, state, district, department,
      page = 1, limit = 10, sortBy = 'eventDate', sortOrder = 'asc'
    } = req.query;

    const query = { status: 'Approved' };

    const safeSearch = readQueryString(search, 'search', MAX_SEARCH_LENGTH);
    const safeCategory = readQueryString(category, 'category', MAX_FILTER_LENGTH);
    const safeStatus = readQueryString(status, 'status', MAX_FILTER_LENGTH);
    const safeOrganizer = readQueryString(organizer, 'organizer', MAX_FILTER_LENGTH);
    const safeSortBy = readQueryString(sortBy, 'sortBy', 30) || 'eventDate';
    const safeSortOrder = readQueryString(sortOrder, 'sortOrder', 4) || 'asc';

    if (!ALLOWED_SORT_FIELDS.has(safeSortBy)) {
      return res.status(400).json({ success: false, message: 'Invalid sort field' });
    }
    if (!['asc', 'desc'].includes(safeSortOrder)) {
      return res.status(400).json({ success: false, message: 'sortOrder must be asc or desc' });
    }

    // Public endpoint: ignore status filter, force Approved. If admin wants all, they should use different endpoint (not in scope).
    // We respect the forced Approved for public.

    if (safeSearch) {
      const escaped = escapeRegex(safeSearch);
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } },
        { location: { $regex: escaped, $options: 'i' } }
      ];
    }

    if (safeCategory) {
      query.category = { $regex: escapeRegex(safeCategory), $options: 'i' };
    }

    if (safeOrganizer) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(safeOrganizer)) {
        query.organizer = safeOrganizer;
      }
    }

    if (sourceType && ALLOWED_SOURCE_TYPES.includes(sourceType)) {
      query.sourceType = sourceType;
    }
    if (eventFormat && ALLOWED_EVENT_FORMATS.includes(eventFormat)) {
      query.eventFormat = eventFormat;
    }
    const safeState = readQueryString(state, 'state', MAX_FILTER_LENGTH);
    if (safeState) {
      query.state = { $regex: escapeRegex(safeState), $options: 'i' };
    }
    const safeDistrict = readQueryString(district, 'district', MAX_FILTER_LENGTH);
    if (safeDistrict) {
      query.district = { $regex: escapeRegex(safeDistrict), $options: 'i' };
    }
    const safeDepartment = readQueryString(department, 'department', MAX_FILTER_LENGTH);
    if (safeDepartment) {
      query.department = { $regex: escapeRegex(safeDepartment), $options: 'i' };
    }

    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const sortOptions = {};
    sortOptions[safeSortBy] = safeSortOrder === 'asc' ? 1 : -1;

    const events = await Event.find(query)
      .populate('organizer', 'name email organizationName')
      .sort(sortOptions)
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      message: 'Events retrieved successfully',
      data: events,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Get events error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching events. Please try again.' });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const user = await getOptionalUser(req);
    const isPrivileged =
      !!user &&
      (user.role === 'admin' ||
        (user.role === 'organizer' &&
          String(event.organizer) === String(user._id)));

    // Non-approved events are visible only to the owner organizer or an admin.
    if (event.status !== 'Approved' && !isPrivileged) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Organizer PII (phone, bio) is exposed only to the owner organizer or an admin.
    // Public/anonymous viewers receive a minimal organizer projection.
    const organizerProjection = isPrivileged
      ? 'name email organizationName organizationType phone bio'
      : 'name email organizationName organizationType';

    await event.populate('organizer', organizerProjection);
    await event.populate('createdBy', 'name email');

    res.json({ success: true, message: 'Event retrieved successfully', data: event });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }
    console.error('Get event error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching event. Please try again.' });
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = String(event.organizer) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this event' });
    }

    if (!isAdmin) {
      if (req.body.organizer && String(req.body.organizer) !== String(event.organizer)) {
        return res.status(403).json({ success: false, message: 'Organizers cannot change organizer' });
      }
      if (req.body.status && String(req.body.status).trim() === 'Approved') {
        return res.status(403).json({ success: false, message: 'Organizers cannot approve events' });
      }
    }

    const {
      title, description, category, location, eventDate, registrationDeadline,
      capacity, status, imageUrl, eligibility, benefits, documentsRequired,
      registrationFee: rawFeeUpdate, isPaidEvent: rawIsPaidUpdate,
      department, schemeId, sourceType, eventFormat, targetAudience,
      ward, district, state, contactInfo
    } = req.body;

    if (title !== undefined) {
      const trimmed = String(title).trim();
      if (trimmed.length < 3) return res.status(400).json({ success: false, message: 'Title must be at least 3 characters' });
      event.title = trimmed;
    }
    if (description !== undefined) {
      const trimmed = String(description).trim();
      if (trimmed.length < 10) return res.status(400).json({ success: false, message: 'Description must be at least 10 characters' });
      event.description = trimmed;
    }
    if (category !== undefined) {
      const trimmed = String(category).trim();
      if (trimmed.length < 2) return res.status(400).json({ success: false, message: 'Category must be at least 2 characters' });
      event.category = trimmed;
    }
    if (location !== undefined) {
      event.location = String(location).trim();
    }
    if (eventDate !== undefined) {
      const parsed = new Date(eventDate);
      if (isNaN(parsed.getTime())) return res.status(400).json({ success: false, message: 'Invalid eventDate' });
      event.eventDate = parsed;
    }
    if (registrationDeadline !== undefined) {
      if (registrationDeadline === '' || registrationDeadline === null) {
        event.registrationDeadline = null;
      } else {
        const parsed = new Date(registrationDeadline);
        if (isNaN(parsed.getTime())) return res.status(400).json({ success: false, message: 'Invalid registrationDeadline' });
        const effectiveEventDate = event.eventDate;
        if (parsed > effectiveEventDate) return res.status(400).json({ success: false, message: 'registrationDeadline cannot be after eventDate' });
        event.registrationDeadline = parsed;
      }
    }
    if (capacity !== undefined) {
      if (capacity === '' || capacity === null) {
        event.capacity = undefined;
      } else {
        const capNum = Number(capacity);
        if (isNaN(capNum) || !Number.isInteger(capNum) || capNum < 1 || capNum > 10000) {
          return res.status(400).json({ success: false, message: 'Capacity must be an integer between 1 and 10000' });
        }
        event.capacity = capNum;
      }
    }
    if (imageUrl !== undefined) {
      const trimmed = String(imageUrl).trim();
      if (trimmed && !/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i.test(trimmed)) {
        return res.status(400).json({ success: false, message: 'Image URL must be a valid URL starting with http:// or https://' });
      }
      event.imageUrl = trimmed;
    }
    if (eligibility !== undefined) event.eligibility = String(eligibility).trim();
    if (benefits !== undefined) event.benefits = String(benefits).trim();
    if (documentsRequired !== undefined) event.documentsRequired = sanitizeDocList(documentsRequired);
    if (department !== undefined) event.department = typeof department === 'string' ? department.trim() : '';
    if (schemeId !== undefined) event.schemeId = schemeId || null;
    if (sourceType !== undefined) event.sourceType = sourceType;
    if (eventFormat !== undefined) event.eventFormat = eventFormat;
    if (targetAudience !== undefined) event.targetAudience = Array.isArray(targetAudience) ? targetAudience.filter(a => typeof a === 'string' && a.trim()).map(a => a.trim()).slice(0, 20) : [];
    if (ward !== undefined) event.ward = typeof ward === 'string' ? ward.trim() : '';
    if (district !== undefined) event.district = typeof district === 'string' ? district.trim() : '';
    if (state !== undefined) event.state = typeof state === 'string' ? state.trim() : '';
    if (contactInfo !== undefined) event.contactInfo = typeof contactInfo === 'string' ? contactInfo.trim() : '';
    if (rawFeeUpdate !== undefined) {
      const fee = Number(rawFeeUpdate);
      if (isNaN(fee) || fee < 0) return res.status(400).json({ success: false, message: 'Registration fee cannot be negative' });
      event.registrationFee = fee;
      if (fee > 0 && rawIsPaidUpdate !== false) event.isPaidEvent = true;
      else if (fee === 0) { event.isPaidEvent = false; }
    }
    if (rawIsPaidUpdate !== undefined) {
      event.isPaidEvent = !!rawIsPaidUpdate;
      if (!event.isPaidEvent) event.registrationFee = 0;
      else if (event.registrationFee <= 0) {
        return res.status(400).json({ success: false, message: 'Paid events require a registration fee greater than 0' });
      }
    }

    if (status !== undefined) {
      const normalized = String(status).trim();
      if (!['Pending', 'Approved', 'Rejected', 'Draft'].includes(normalized)) {
        return res.status(400).json({ success: false, message: 'Status must be Pending, Approved, Rejected or Draft' });
      }
      if (!isAdmin && normalized === 'Approved') {
        return res.status(403).json({ success: false, message: 'Organizers cannot approve events' });
      }
      event.status = normalized;
    } else {
      // If organizer edits an Approved event without explicitly setting status, revert to Pending for admin review
      if (!isAdmin && event.status === 'Approved') {
        const hasMeaningfulChange = title !== undefined || description !== undefined || category !== undefined || location !== undefined || eventDate !== undefined || capacity !== undefined || imageUrl !== undefined || department !== undefined || schemeId !== undefined || sourceType !== undefined || eventFormat !== undefined || state !== undefined || district !== undefined;
        if (hasMeaningfulChange) {
          event.status = 'Pending';
        }
      }
    }

    // Final cross-field validation: registrationDeadline not after eventDate
    if (event.registrationDeadline && event.eventDate && event.registrationDeadline > event.eventDate) {
      return res.status(400).json({ success: false, message: 'registrationDeadline cannot be after eventDate' });
    }

    const updated = await event.save();
    await updated.populate('organizer', 'name email organizationName');
    await updated.populate('createdBy', 'name email');

    // Notify registered users about event update (meaningful changes only)
    const hasMeaningfulChange = title !== undefined || description !== undefined || category !== undefined || location !== undefined || eventDate !== undefined || capacity !== undefined || imageUrl !== undefined || rawFeeUpdate !== undefined || rawIsPaidUpdate !== undefined || registrationDeadline !== undefined || department !== undefined || schemeId !== undefined || sourceType !== undefined || eventFormat !== undefined || targetAudience !== undefined || ward !== undefined || district !== undefined || state !== undefined || contactInfo !== undefined;
    if (hasMeaningfulChange) {
      try {
        const registrations = await Registration.find({ event: event._id, status: { $in: ['Pending', 'Confirmed'] } }).select('user').lean();
        for (const reg of registrations) {
          await sendEventUpdatedNotification(reg.user, updated.title).catch(() => {});
        }
      } catch (e) {
        console.warn('Failed to notify users of event update:', e.message);
      }
    }

    res.json({ success: true, message: 'Event updated successfully', data: updated });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }
    const validation = extractValidationErrors(err);
    if (validation) {
      return res.status(400).json({ success: false, ...validation });
    }
    console.error('Update event error:', err);
    res.status(500).json({ success: false, message: 'Server error updating event. Please try again.' });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = String(event.organizer) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this event' });
    }

    // Notify registered users about event cancellation
    try {
      const registrations = await Registration.find({ event: event._id, status: { $in: ['Pending', 'Confirmed'] } }).select('user').lean();
      for (const reg of registrations) {
        await sendEventCancelledNotification(reg.user, event.title).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to notify users of event cancellation:', e.message);
    }

    await Event.findByIdAndDelete(req.params.id);
    await Notification.deleteMany({ relatedEvent: event._id });

    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }
    console.error('Delete event error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting event. Please try again.' });
  }
};

const getOrganizerEvents = async (req, res) => {
  try {
    const {
      search, category, status,
      page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    const query = { organizer: req.user._id };

    const safeSearch = readQueryString(search, 'search', MAX_SEARCH_LENGTH);
    const safeCategory = readQueryString(category, 'category', MAX_FILTER_LENGTH);
    const safeStatus = readQueryString(status, 'status', MAX_FILTER_LENGTH);
    const safeSortBy = readQueryString(sortBy, 'sortBy', 30) || 'createdAt';
    const safeSortOrder = readQueryString(sortOrder, 'sortOrder', 4) || 'desc';

    if (!ALLOWED_SORT_FIELDS.has(safeSortBy)) {
      return res.status(400).json({ success: false, message: 'Invalid sort field' });
    }
    if (!['asc', 'desc'].includes(safeSortOrder)) {
      return res.status(400).json({ success: false, message: 'sortOrder must be asc or desc' });
    }

    if (safeSearch) {
      const escaped = escapeRegex(safeSearch);
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } },
        { location: { $regex: escaped, $options: 'i' } }
      ];
    }

    if (safeCategory) {
      query.category = { $regex: escapeRegex(safeCategory), $options: 'i' };
    }

    if (safeStatus) {
      if (!['Pending', 'Approved', 'Rejected', 'Draft'].includes(safeStatus)) {
        return res.status(400).json({ success: false, message: 'Status must be Pending, Approved, Rejected or Draft' });
      }
      query.status = safeStatus;
    }

    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const sortOptions = {};
    sortOptions[safeSortBy] = safeSortOrder === 'asc' ? 1 : -1;

    const events = await Event.find(query)
      .populate('organizer', 'name email organizationName')
      .sort(sortOptions)
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      message: 'Organizer events retrieved successfully',
      data: events,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Get organizer events error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching organizer events. Please try again.' });
  }
};

const getAdminEvents = async (req, res) => {
  try {
    const {
      search, category, status, organizer,
      sourceType, eventFormat, state, district, department,
      page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    const query = {};

    const safeSearch = readQueryString(search, 'search', MAX_SEARCH_LENGTH);
    const safeCategory = readQueryString(category, 'category', MAX_FILTER_LENGTH);
    const safeStatus = readQueryString(status, 'status', MAX_FILTER_LENGTH);
    const safeOrganizer = readQueryString(organizer, 'organizer', MAX_FILTER_LENGTH);
    const safeSortBy = readQueryString(sortBy, 'sortBy', 30) || 'createdAt';
    const safeSortOrder = readQueryString(sortOrder, 'sortOrder', 4) || 'desc';

    if (!ALLOWED_SORT_FIELDS.has(safeSortBy)) {
      return res.status(400).json({ success: false, message: 'Invalid sort field' });
    }
    if (!['asc', 'desc'].includes(safeSortOrder)) {
      return res.status(400).json({ success: false, message: 'sortOrder must be asc or desc' });
    }

    if (safeStatus) {
      if (!['Pending', 'Approved', 'Rejected', 'Draft'].includes(safeStatus)) {
        return res.status(400).json({ success: false, message: 'Status must be Pending, Approved, Rejected or Draft' });
      }
      query.status = safeStatus;
    }

    if (safeSearch) {
      const escaped = escapeRegex(safeSearch);
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } },
        { location: { $regex: escaped, $options: 'i' } },
        { department: { $regex: escaped, $options: 'i' } }
      ];
    }

    if (safeCategory) {
      query.category = { $regex: escapeRegex(safeCategory), $options: 'i' };
    }

    if (safeOrganizer) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(safeOrganizer)) {
        query.organizer = safeOrganizer;
      }
    }

    if (sourceType && ALLOWED_SOURCE_TYPES.includes(sourceType)) {
      query.sourceType = sourceType;
    }
    if (eventFormat && ALLOWED_EVENT_FORMATS.includes(eventFormat)) {
      query.eventFormat = eventFormat;
    }
    const safeState = readQueryString(state, 'state', MAX_FILTER_LENGTH);
    if (safeState) {
      query.state = { $regex: escapeRegex(safeState), $options: 'i' };
    }
    const safeDistrict = readQueryString(district, 'district', MAX_FILTER_LENGTH);
    if (safeDistrict) {
      query.district = { $regex: escapeRegex(safeDistrict), $options: 'i' };
    }
    const safeDepartment = readQueryString(department, 'department', MAX_FILTER_LENGTH);
    if (safeDepartment) {
      query.department = { $regex: escapeRegex(safeDepartment), $options: 'i' };
    }

    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const sortOptions = {};
    sortOptions[safeSortBy] = safeSortOrder === 'asc' ? 1 : -1;

    const events = await Event.find(query)
      .populate('organizer', 'name email organizationName')
      .populate('schemeId', 'title')
      .sort(sortOptions)
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      message: 'Admin events retrieved successfully',
      data: events,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Get admin events error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching admin events. Please try again.' });
  }
};

const getAdminEventStats = async (req, res) => {
  try {
    const [total, pending, approved, rejected, draft] = await Promise.all([
      Event.countDocuments({}),
      Event.countDocuments({ status: 'Pending' }),
      Event.countDocuments({ status: 'Approved' }),
      Event.countDocuments({ status: 'Rejected' }),
      Event.countDocuments({ status: 'Draft' })
    ]);
    res.json({
      success: true,
      data: { total, pending, approved, rejected, draft }
    });
  } catch (err) {
    console.error('Get admin event stats error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching event statistics.' });
  }
};

const getAdminEventMeta = async (req, res) => {
  try {
    const [categories, sourceTypes, departments, states] = await Promise.all([
      Event.distinct('category'),
      Event.distinct('sourceType'),
      Event.distinct('department'),
      Event.distinct('state')
    ]);
    res.json({
      success: true,
      data: {
        categories: (categories || []).filter(Boolean).sort(),
        sourceTypes: (sourceTypes || []).filter(Boolean).sort(),
        departments: (departments || []).filter(Boolean).sort(),
        states: (states || []).filter(Boolean).sort()
      }
    });
  } catch (err) {
    console.error('Get admin event meta error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching event filters.' });
  }
};

const updateEventStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['Pending', 'Approved', 'Rejected', 'Draft'].includes(String(status).trim())) {
      return res.status(400).json({ success: false, message: 'Status must be Pending, Approved, Rejected or Draft' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const requested = String(status).trim();

    // Prevent no-op duplicate approval/rejection so an already-approved or
    // already-rejected event cannot be "approved"/"rejected" again.
    if ((requested === 'Approved' || requested === 'Rejected') && event.status === requested) {
      return res.status(400).json({ success: false, message: `Event is already ${requested.toLowerCase()}` });
    }

    event.status = requested;
    const updated = await event.save();
    await updated.populate('organizer', 'name email organizationName');
    await updated.populate('createdBy', 'name email');

    // Notify organizer about status change
    if (updated.organizer && typeof updated.organizer === 'object' && updated.organizer._id) {
      const notifUserId = String(updated.organizer._id);
      const notifTitle = event.status === 'Approved' ? 'Event Approved' : event.status === 'Rejected' ? 'Event Rejected' : `Event ${event.status}`;
      const notifMessage = event.status === 'Approved' ? `"${event.title}" has been approved and is now visible to the public.` : event.status === 'Rejected' ? `"${event.title}" was rejected by the admin.` : `Status of "${event.title}" changed to ${event.status}.`;
      if (event.status === 'Approved') {
        await sendEventApprovedNotification(notifUserId, event.title).catch(() => {});
      } else if (event.status === 'Rejected') {
        await sendEventRejectedNotification(notifUserId, event.title).catch(() => {});
      } else {
        await sendEventUpdatedNotification(notifUserId, event.title).catch(() => {});
      }
    }

    res.json({ success: true, message: `Event status updated to ${event.status}`, data: updated });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }
    const validation = extractValidationErrors(err);
    if (validation) {
      return res.status(400).json({ success: false, ...validation });
    }
    console.error('Update event status error:', err);
    res.status(500).json({ success: false, message: 'Server error updating event status. Please try again.' });
  }
};

// GET /api/events/organizer/analytics - organizer/admin
const getOrganizerAnalytics = async (req, res) => {
  try {
    const organizerFilter = req.user.role === 'admin' ? {} : { organizer: req.user._id };

    const [events, registrationAgg, paymentAgg] = await Promise.all([
      Event.find(organizerFilter).select('_id title status isPaidEvent registrationFee registrationCount capacity createdAt').lean(),
      Registration.aggregate([
        { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'eventDoc' } },
        { $unwind: '$eventDoc' },
        ...(req.user.role === 'admin' ? [] : [{ $match: { 'eventDoc.organizer': new (require('mongoose').Types.ObjectId)(req.user._id) } }]),
        { $group: { _id: '$status', count: { $sum: 1 }, totalGuests: { $sum: { $ifNull: ['$numberOfGuests', 1] } } } }
      ]),
      Payment.aggregate([
        { $match: { status: 'Paid' } },
        { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'eventDoc' } },
        { $unwind: '$eventDoc' },
        ...(req.user.role === 'admin' ? [] : [{ $match: { 'eventDoc.organizer': new (require('mongoose').Types.ObjectId)(req.user._id) } }]),
        { $group: { _id: null, totalRevenue: { $sum: '$amount' }, paidPayments: { $sum: 1 } } }
      ])
    ]);

    const regMap = {};
    let totalGuests = 0;
    (registrationAgg || []).forEach(r => {
      regMap[r._id] = r.count;
      totalGuests += r.totalGuests;
    });

    const totalRevenue = paymentAgg[0]?.totalRevenue || 0;

    // Per-event performance
    const eventPerformance = events.map(e => {
      const evRegs = e.registrationCount || 0;
      return {
        _id: e._id,
        title: e.title,
        status: e.status,
        isPaidEvent: e.isPaidEvent || false,
        registrationFee: e.registrationFee || 0,
        registrations: evRegs,
        capacity: e.capacity || null,
        createdAt: e.createdAt
      };
    });

    const overview = {
      totalEvents: events.length,
      approvedEvents: events.filter(e => e.status === 'Approved').length,
      pendingEvents: events.filter(e => e.status === 'Pending').length,
      rejectedEvents: events.filter(e => e.status === 'Rejected').length,
      draftEvents: events.filter(e => e.status === 'Draft').length,
      paidEvents: events.filter(e => e.isPaidEvent).length,
      freeEvents: events.filter(e => !e.isPaidEvent).length,
      totalRegistrations: Object.values(regMap).reduce((s, c) => s + c, 0),
      confirmedRegistrations: regMap['Confirmed'] || 0,
      pendingRegistrations: regMap['Pending'] || 0,
      rejectedRegistrations: regMap['Rejected'] || 0,
      cancelledRegistrations: regMap['Cancelled'] || 0,
      totalGuests,
      totalRevenue
    };

    res.json({ success: true, data: { overview, eventPerformance } });
  } catch (err) {
    console.error('Organizer analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching analytics' });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getOrganizerEvents,
  getAdminEvents,
  getAdminEventStats,
  getAdminEventMeta,
  updateEventStatus,
  getOrganizerAnalytics
};
