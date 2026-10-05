const Registration = require('../models/Registration');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const { 
  sendEventRegistrationNotification,
  sendRegistrationConfirmedNotification,
  sendRegistrationRejectedNotification,
  sendRegistrationCancelledNotification,
  sendTicketGeneratedNotification,
  sendCheckInSuccessNotification
} = require('../utils/notificationService');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^\+?[0-9\s\-]{8,15}$/.test(phone);

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

const getCurrentGuestCount = async (eventId) => {
  const result = await Registration.aggregate([
    { $match: { event: new mongoose.Types.ObjectId(eventId), status: { $in: ['Pending', 'Confirmed'] } } },
    { $group: { _id: null, total: { $sum: '$numberOfGuests' } } }
  ]);
  return result[0]?.total || 0;
};

const generateTicketId = () => {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 8; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  return `EVT-${year}-${rand}`;
};

const generateUniqueTicketId = async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateTicketId();
    const exists = await Registration.findOne({ ticketId: candidate }).select('_id').lean();
    if (!exists) return candidate;
  }
  return `EVT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-8)}${Math.random().toString(36).toUpperCase().slice(2, 6)}`;
};

const buildQrPayload = (registration) => {
  const eventId = registration.event?._id ? String(registration.event._id) : String(registration.event);
  const payload = {
    ticketId: registration.ticketId,
    registrationId: String(registration._id),
    eventId
  };
  return JSON.stringify(payload);
};

// 1. createRegistration - POST /api/registrations - user only
const createRegistration = async (req, res) => {
  try {
    const { eventId, name, email, phone, numberOfGuests, message } = req.body;
    const userId = req.user._id;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'eventId is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid eventId format' });
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
    const guests = numberOfGuests !== undefined && numberOfGuests !== null && numberOfGuests !== '' ? Number(numberOfGuests) : 1;
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({ success: false, message: 'Name is required and must be at least 2 characters' });
    }
    if (trimmedName.length > 100) {
      return res.status(400).json({ success: false, message: 'Name cannot exceed 100 characters' });
    }
    if (!trimmedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!isValidEmail(trimmedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }
    if (trimmedEmail.length > 150) {
      return res.status(400).json({ success: false, message: 'Email cannot exceed 150 characters' });
    }
    if (!trimmedPhone) {
      return res.status(400).json({ success: false, message: 'Phone is required' });
    }
    if (!isValidPhone(trimmedPhone)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid phone number' });
    }
    if (trimmedPhone.length > 15) {
      return res.status(400).json({ success: false, message: 'Phone cannot exceed 15 characters' });
    }
    if (isNaN(guests) || !Number.isInteger(guests) || guests < 1 || guests > 20) {
      return res.status(400).json({ success: false, message: 'numberOfGuests must be an integer between 1 and 20' });
    }
    if (trimmedMessage && trimmedMessage.length > 500) {
      return res.status(400).json({ success: false, message: 'Message cannot exceed 500 characters' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.status !== 'Approved') {
      return res.status(400).json({ success: false, message: `Cannot register for event with status ${event.status}` });
    }

    const now = new Date();
    if (event.eventDate && new Date(event.eventDate) < now) {
      return res.status(400).json({ success: false, message: 'Event has already passed' });
    }

    if (event.registrationDeadline && new Date(event.registrationDeadline) < now) {
      return res.status(400).json({ success: false, message: 'Registration deadline has passed' });
    }

    // Prevent duplicate active registration
    const existingActive = await Registration.findOne({
      user: userId,
      event: eventId,
      status: { $in: ['Pending', 'Confirmed'] }
    });
    if (existingActive) {
      return res.status(400).json({ success: false, message: 'You have already registered for this event' });
    }

    // Capacity check
    if (event.capacity) {
      const currentGuests = await getCurrentGuestCount(eventId);
      if (currentGuests + guests > event.capacity) {
        return res.status(400).json({ success: false, message: 'Not enough seats available' });
      }
    }

    const registration = new Registration({
      user: userId,
      event: eventId,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      numberOfGuests: guests,
      message: trimmedMessage,
      status: 'Pending',
      registeredAt: new Date()
    });

    let saved;
    try {
      saved = await registration.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ success: false, message: 'You have already registered for this event' });
      }
      throw err;
    }

    // Increment registrationCount by numberOfGuests (guest count) - keep consistent with capacity logic
    // Also increment by 1 for count? We use guest count for capacity, so increment by guests
    try {
      await Event.findByIdAndUpdate(eventId, { $inc: { registrationCount: guests } });
    } catch (e) {
      console.warn('Failed to increment registrationCount:', e.message);
    }

    await saved.populate('event', 'title category location eventDate status imageUrl organizer');
    await saved.populate('user', 'name email');

    await sendEventRegistrationNotification(userId, event.title).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully',
      data: saved
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    const validation = extractValidationErrors(err);
    if (validation) {
      return res.status(400).json({ success: false, ...validation });
    }
    console.error('Create registration error:', err);
    res.status(500).json({ success: false, message: 'Server error creating registration. Please try again.' });
  }
};

// 2. getMyRegistrations - GET /api/registrations/my - user only
const getMyRegistrations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

    const total = await Registration.countDocuments(query);
    const registrations = await Registration.find(query)
      .populate('event', 'title category location eventDate status imageUrl organizer isPaidEvent registrationFee')
      .populate('event.organizer', 'name email organizationName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Also populate organizer via event
    // Since lean, we need to populate organizer for event - already done via populate, but lean needs separate
    // For simplicity, return as is

    res.json({
      success: true,
      data: registrations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get my registrations error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching registrations' });
  }
};

// 3. getRegistrationById - GET /api/registrations/:id - user/organizer/admin
const getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid registration ID format' });
    }

    const registration = await Registration.findById(id)
      .populate('user', 'name email phone')
      .populate('event', 'title category location eventDate organizer status capacity isPaidEvent registrationFee imageUrl');

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    const userRole = req.user.role;
    const userId = String(req.user._id);

    if (userRole === 'admin') {
      // Admin can view any
      return res.json({ success: true, data: registration });
    }

    if (userRole === 'user' && String(registration.user._id || registration.user) === userId) {
      return res.json({ success: true, data: registration });
    }

    // Organizer can view if event belongs to them
    if (userRole === 'organizer') {
      const event = await Event.findById(registration.event._id || registration.event);
      if (event && String(event.organizer) === userId) {
        return res.json({ success: true, data: registration });
      }
    }

    // Also organizer might be viewing via event check - if not own, deny
    return res.status(403).json({ success: false, message: 'Not authorized to view this registration' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid registration ID format' });
    }
    console.error('Get registration error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching registration' });
  }
};

// 4. cancelRegistration - PATCH /api/registrations/:id/cancel - user only
const cancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid registration ID format' });
    }

    const registration = await Registration.findById(id);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    if (String(registration.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this registration' });
    }

    if (registration.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Registration is already cancelled' });
    }
    if (registration.status === 'Rejected') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a rejected registration' });
    }
    if (!['Pending', 'Confirmed'].includes(registration.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel registration with status ${registration.status}` });
    }

    const previousStatus = registration.status;
    registration.status = 'Cancelled';
    await registration.save();

    // Decrease registrationCount if previously counted (Pending or Confirmed)
    if (['Pending', 'Confirmed'].includes(previousStatus)) {
      const dec = registration.numberOfGuests || 1;
      try {
        const updated = await Event.findByIdAndUpdate(registration.event, { $inc: { registrationCount: -dec } });
        // Ensure not negative - clamp to 0 if needed
        if (updated && updated.registrationCount - dec < 0) {
          await Event.findByIdAndUpdate(registration.event, { $set: { registrationCount: 0 } });
        }
        // Extra safety: if still negative due to race, set to 0
        const refreshed = await Event.findById(registration.event).select('registrationCount');
        if (refreshed && refreshed.registrationCount < 0) {
          await Event.findByIdAndUpdate(registration.event, { $set: { registrationCount: 0 } });
        }
      } catch (e) {
        console.warn('Failed to decrement registrationCount:', e.message);
      }
    }

    await registration.populate('event', 'title category location eventDate status');
    await registration.populate('user', 'name email');

    await sendRegistrationCancelledNotification(String(registration.user._id || registration.user), registration.event.title).catch(() => {});

    res.json({ success: true, message: 'Registration cancelled successfully', data: registration });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid registration ID format' });
    }
    console.error('Cancel registration error:', err);
    res.status(500).json({ success: false, message: 'Server error cancelling registration' });
  }
};

// 5. getEventRegistrations - GET /api/registrations/event/:eventId - organizer/admin
const getEventRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid eventId format' });
    }

    const event = await Event.findById(eventId).select('organizer title');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = String(event.organizer) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to view registrations for this event' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const allowedSort = new Set(['createdAt', 'updatedAt', 'name', 'email', 'status']);
    const safeSortBy = allowedSort.has(sortBy) ? sortBy : 'createdAt';

    const query = { event: eventId };

    if (req.query.status) {
      const s = String(req.query.status).trim();
      if (['Pending', 'Confirmed', 'Rejected', 'Cancelled'].includes(s)) {
        query.status = s;
      }
    }

    if (req.query.search) {
      const term = String(req.query.search).trim();
      if (term) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
          { phone: { $regex: escaped, $options: 'i' } }
        ];
      }
    }

    const sortOptions = {};
    // For name/email sort, we sort by those fields directly
    if (['name', 'email', 'status', 'createdAt', 'updatedAt'].includes(safeSortBy)) {
      sortOptions[safeSortBy] = sortOrder;
    } else {
      sortOptions['createdAt'] = -1;
    }

    const total = await Registration.countDocuments(query);
    const registrations = await Registration.find(query)
      .populate('user', 'name email phone')
      .populate('event', 'title eventDate capacity')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: registrations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get event registrations error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching event registrations' });
  }
};

// 6. updateRegistrationStatus - PATCH /api/registrations/:id/status - organizer/admin
const updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid registration ID format' });
    }
    if (!status || !['Pending', 'Confirmed', 'Rejected', 'Cancelled'].includes(String(status).trim())) {
      return res.status(400).json({ success: false, message: 'Status must be Pending, Confirmed, Rejected or Cancelled' });
    }
    const newStatus = String(status).trim();

    const registration = await Registration.findById(id).populate('event');
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    const event = await Event.findById(registration.event._id || registration.event);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Associated event not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = String(event.organizer) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this registration' });
    }

    const oldStatus = registration.status;
    if (oldStatus === newStatus) {
      return res.status(400).json({ success: false, message: `Registration is already ${newStatus}` });
    }

    // Capacity check for Pending->Confirmed and Rejected->Confirmed
    const willBecomeActive = newStatus === 'Confirmed';
    const wasActive = ['Pending', 'Confirmed'].includes(oldStatus);
    const willBeActive = ['Pending', 'Confirmed'].includes(newStatus);

    if (willBecomeActive && event.capacity) {
      // If transitioning to Confirmed, check capacity
      // Need to consider that if already Pending, it's already counted, so confirming doesn't increase guest count beyond current
      // But spec says: If changing Pending->Confirmed make sure capacity is still respected. If confirmation would exceed capacity return 400.
      // For Pending->Confirmed, guest count already counted, so no extra capacity needed? However if we count both Pending and Confirmed, then confirming doesn't change count. But spec says need to check.
      // To be safe, we check current guest count excluding this registration's old status, then add new
      const currentGuests = await getCurrentGuestCount(event._id);
      // Adjust currentGuests to exclude this registration if it was active
      let adjustedCurrent = currentGuests;
      if (wasActive) {
        adjustedCurrent -= (registration.numberOfGuests || 1);
      }
      if (adjustedCurrent + (registration.numberOfGuests || 1) > event.capacity) {
        return res.status(400).json({ success: false, message: 'Not enough seats available' });
      }
    }

    // Handle registrationCount adjustments
    // We maintain Event.registrationCount as sum of guests for active registrations (Pending+Confirmed)
    // Transitions:
    // Pending->Confirmed: no net change (already counted)
    // Pending->Rejected: decrement (remove from active)
    // Pending->Cancelled: decrement
    // Confirmed->Rejected: decrement
    // Confirmed->Cancelled: decrement
    // Rejected->Confirmed: increment (if capacity allows, already checked)
    // Rejected->Pending: increment
    // Cancelled->Pending/Confirmed: increment (if capacity allows)
    let inc = 0;
    if (wasActive && !willBeActive) {
      inc = -(registration.numberOfGuests || 1);
    } else if (!wasActive && willBeActive) {
      inc = (registration.numberOfGuests || 1);
    } else if (wasActive && willBeActive) {
      inc = 0; // Pending<->Confirmed no change
    }

    registration.status = newStatus;

    // Ticket handling as per Phase 4.6
    if (oldStatus === 'Pending' && newStatus === 'Confirmed') {
      if (!registration.ticketId || registration.ticketStatus !== 'Active') {
        if (!registration.ticketId) {
          registration.ticketId = await generateUniqueTicketId();
          registration.ticketIssuedAt = new Date();
        }
        if (!registration.ticketIssuedAt) registration.ticketIssuedAt = new Date();
        registration.ticketStatus = 'Active';
      } else {
        registration.ticketStatus = 'Active';
      }
    } else if (oldStatus === 'Confirmed' && (newStatus === 'Rejected' || newStatus === 'Cancelled')) {
      registration.ticketStatus = 'Cancelled';
    } else if (oldStatus === 'Rejected' && newStatus === 'Confirmed') {
      if (!registration.ticketId || registration.ticketStatus !== 'Active') {
        registration.ticketId = await generateUniqueTicketId();
        registration.ticketIssuedAt = new Date();
        registration.ticketStatus = 'Active';
      } else {
        registration.ticketStatus = 'Active';
      }
    } else if (oldStatus === 'Pending' && newStatus === 'Rejected') {
      registration.ticketStatus = 'NotIssued';
    } else if (oldStatus === 'Cancelled' && willBecomeActive) {
      // Cancelled -> Pending/Confirmed via status update (though normally new registration, handle anyway)
      if (!registration.ticketId || registration.ticketStatus !== 'Active') {
        registration.ticketId = await generateUniqueTicketId();
        registration.ticketIssuedAt = new Date();
        registration.ticketStatus = 'Active';
      }
    } else if (!wasActive && willBeActive) {
      // Generic: any transition into active that hasn't been handled, ensure ticket
      if (!registration.ticketId) {
        registration.ticketId = await generateUniqueTicketId();
        registration.ticketIssuedAt = new Date();
        registration.ticketStatus = 'Active';
      } else if (registration.ticketStatus !== 'Active') {
        registration.ticketStatus = 'Active';
        if (!registration.ticketIssuedAt) registration.ticketIssuedAt = new Date();
      }
    } else if (wasActive && !willBeActive) {
      // Generic fallback for active -> inactive where not already handled
      if (registration.ticketStatus === 'Active') {
        registration.ticketStatus = 'Cancelled';
      }
    }

    await registration.save();

    if (inc !== 0) {
      try {
        await Event.findByIdAndUpdate(event._id, { $inc: { registrationCount: inc } });
        const refreshed = await Event.findById(event._id).select('registrationCount');
        if (refreshed && refreshed.registrationCount < 0) {
          await Event.findByIdAndUpdate(event._id, { $set: { registrationCount: 0 } });
        }
      } catch (e) {
        console.warn('Failed to update registrationCount:', e.message);
      }
    }

    await registration.populate('user', 'name email phone');
    await registration.populate('event', 'title category location eventDate organizer status capacity');

    // Notify user about status change
    const regUserId = String(registration.user._id || registration.user);
    if (newStatus === 'Confirmed') {
      await sendRegistrationConfirmedNotification(regUserId, registration.event.title).catch(() => {});
    } else if (newStatus === 'Rejected') {
      await sendRegistrationRejectedNotification(regUserId, registration.event.title).catch(() => {});
    }

    res.json({ success: true, message: `Registration status updated to ${newStatus}`, data: registration });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    const validation = extractValidationErrors(err);
    if (validation) {
      return res.status(400).json({ success: false, ...validation });
    }
    console.error('Update registration status error:', err);
    res.status(500).json({ success: false, message: 'Server error updating registration status' });
  }
};

const getTicket = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid registration ID format' });
    }

    const registration = await Registration.findById(id)
      .populate('event', 'title category location eventDate organizer status imageUrl')
      .populate('user', 'name email');

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    const userId = String(req.user._id);
    const userRole = req.user.role;

    // Authorization: owner, organizer of event, admin
    let isAuthorized = false;
    if (userRole === 'admin') isAuthorized = true;
    else if (String(registration.user._id || registration.user) === userId) isAuthorized = true;
    else if (userRole === 'organizer') {
      const event = await Event.findById(registration.event._id || registration.event).select('organizer');
      if (event && String(event.organizer) === userId) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this ticket' });
    }

    // Only confirmed registrations have active tickets
    if (registration.status !== 'Confirmed') {
      return res.status(400).json({ success: false, message: `Ticket not available for registration with status ${registration.status}` });
    }

    // If no ticket exists but should, generate safely
    if (!registration.ticketId || registration.ticketStatus !== 'Active') {
      if (!registration.ticketId) {
        registration.ticketId = await generateUniqueTicketId();
        registration.ticketIssuedAt = new Date();
      }
      registration.ticketStatus = 'Active';
      if (!registration.ticketIssuedAt) registration.ticketIssuedAt = new Date();
      await registration.save();
      await registration.populate('event', 'title category location eventDate organizer status imageUrl');
      await registration.populate('user', 'name email');
    }

    if (registration.ticketStatus !== 'Active') {
      return res.status(400).json({ success: false, message: `Ticket is ${registration.ticketStatus}` });
    }

    const eventDoc = registration.event;
    if (!eventDoc) {
      return res.status(404).json({ success: false, message: 'Associated event not found' });
    }

    const qrPayload = buildQrPayload(registration);

    res.json({
      success: true,
      data: {
        ticketId: registration.ticketId,
        ticketStatus: registration.ticketStatus,
        registrationId: String(registration._id),
        eventId: String(eventDoc._id || registration.event),
        event: {
          _id: eventDoc._id,
          title: eventDoc.title,
          category: eventDoc.category,
          location: eventDoc.location,
          eventDate: eventDoc.eventDate,
          status: eventDoc.status,
          imageUrl: eventDoc.imageUrl
        },
        attendee: {
          name: registration.name,
          email: registration.email,
          phone: registration.phone
        },
        numberOfGuests: registration.numberOfGuests,
        ticketIssuedAt: registration.ticketIssuedAt,
        qrPayload
      }
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    console.error('Get ticket error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching ticket' });
  }
};

const verifyTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!ticketId || typeof ticketId !== 'string' || !ticketId.trim()) {
      return res.status(400).json({ success: false, message: 'Ticket ID is required' });
    }

    const registration = await Registration.findOne({ ticketId: ticketId.trim() })
      .populate('event', 'title category location eventDate organizer status')
      .populate('user', 'name email');

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Invalid ticket' });
    }

    const event = registration.event;
    if (!event) {
      return res.status(404).json({ success: false, message: 'Associated event not found' });
    }

    const userRole = req.user.role;
    const userId = String(req.user._id);

    // Organizer can verify only own events, admin can verify any
    if (userRole === 'organizer') {
      if (String(event.organizer) !== userId) {
        return res.status(403).json({ success: false, message: 'Not authorized to verify tickets for this event' });
      }
    } else if (userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to verify tickets' });
    }

    if (registration.ticketStatus === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Ticket has been cancelled',
        data: {
          ticketId: registration.ticketId,
          ticketStatus: registration.ticketStatus,
          registrationStatus: registration.status,
          attendee: { name: registration.name, email: registration.email },
          numberOfGuests: registration.numberOfGuests,
          event: { title: event.title, eventDate: event.eventDate, location: event.location }
        }
      });
    }

    if (registration.ticketStatus === 'Used') {
      return res.status(400).json({
        success: false,
        message: 'Ticket has already been used',
        data: {
          ticketId: registration.ticketId,
          ticketStatus: registration.ticketStatus,
          registrationStatus: registration.status,
          attendee: { name: registration.name, email: registration.email },
          numberOfGuests: registration.numberOfGuests,
          event: { title: event.title, eventDate: event.eventDate, location: event.location },
          checkedInAt: registration.checkedInAt,
          checkedInBy: registration.checkedInBy
        }
      });
    }

    if (registration.ticketStatus !== 'Active' || registration.status !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: `Ticket is not active (status: ${registration.ticketStatus}, registration: ${registration.status})`,
        data: {
          ticketId: registration.ticketId,
          ticketStatus: registration.ticketStatus,
          registrationStatus: registration.status
        }
      });
    }

    res.json({
      success: true,
      message: 'Valid ticket',
      data: {
        ticketId: registration.ticketId,
        ticketStatus: registration.ticketStatus,
        registrationStatus: registration.status,
        attendee: { name: registration.name, email: registration.email, phone: registration.phone },
        numberOfGuests: registration.numberOfGuests,
        event: { title: event.title, category: event.category, eventDate: event.eventDate, location: event.location, organizer: event.organizer },
        checkedInAt: registration.checkedInAt
      }
    });
  } catch (err) {
    console.error('Verify ticket error:', err);
    res.status(500).json({ success: false, message: 'Server error verifying ticket' });
  }
};

const checkInTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!ticketId || typeof ticketId !== 'string' || !ticketId.trim()) {
      return res.status(400).json({ success: false, message: 'Ticket ID is required' });
    }

    const registration = await Registration.findOne({ ticketId: ticketId.trim() }).populate('event');

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Invalid ticket' });
    }

    const event = registration.event;
    if (!event) {
      return res.status(404).json({ success: false, message: 'Associated event not found' });
    }

    const userRole = req.user.role;
    const userId = String(req.user._id);

    if (userRole === 'organizer') {
      if (String(event.organizer) !== userId) {
        return res.status(403).json({ success: false, message: 'Not authorized to check in tickets for this event' });
      }
    } else if (userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to check in tickets' });
    }

    if (registration.status !== 'Confirmed') {
      return res.status(400).json({ success: false, message: `Cannot check in registration with status ${registration.status}` });
    }

    if (registration.ticketStatus !== 'Active') {
      if (registration.ticketStatus === 'Used') {
        return res.status(400).json({ success: false, message: 'Ticket has already been used' });
      }
      if (registration.ticketStatus === 'Cancelled') {
        return res.status(400).json({ success: false, message: 'Ticket has been cancelled' });
      }
      return res.status(400).json({ success: false, message: `Ticket is not active (status: ${registration.ticketStatus})` });
    }

    registration.ticketStatus = 'Used';
    registration.checkedInAt = new Date();
    registration.checkedInBy = req.user._id;
    await registration.save();

    await sendCheckInSuccessNotification(String(registration.user), event.title).catch(() => {});

    res.json({
      success: true,
      message: 'Ticket checked in successfully',
      data: {
        ticketId: registration.ticketId,
        ticketStatus: registration.ticketStatus,
        checkedInAt: registration.checkedInAt,
        checkedInBy: registration.checkedInBy
      }
    });
  } catch (err) {
    console.error('Check-in ticket error:', err);
    res.status(500).json({ success: false, message: 'Server error checking in ticket' });
  }
};

module.exports = {
  createRegistration,
  getMyRegistrations,
  getRegistrationById,
  cancelRegistration,
  getEventRegistrations,
  updateRegistrationStatus,
  getTicket,
  verifyTicket,
  checkInTicket
};
