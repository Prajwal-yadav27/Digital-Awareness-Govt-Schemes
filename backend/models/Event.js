const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [4000, 'Description cannot exceed 4000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    minlength: [2, 'Category must be at least 2 characters'],
    maxlength: [80, 'Category cannot exceed 80 characters']
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organizer is required'],
    index: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  eventDate: {
    type: Date,
    required: [true, 'Event date is required']
  },
  registrationDeadline: {
    type: Date
  },
  capacity: {
    type: Number,
    min: [1, 'Capacity must be at least 1'],
    max: [10000, 'Capacity cannot exceed 10000']
  },
  status: {
    type: String,
    enum: {
      values: ['Pending', 'Approved', 'Rejected', 'Draft'],
      message: 'Status must be Pending, Approved, Rejected or Draft'
    },
    default: 'Pending',
    index: true
  },
  imageUrl: {
    type: String,
    trim: true,
    maxlength: [500, 'Image URL cannot exceed 500 characters'],
    validate: {
      validator: function (val) {
        if (!val) return true;
        return /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i.test(val);
      },
      message: 'Image URL must be a valid URL starting with http:// or https://'
    }
  },
  eligibility: {
    type: String,
    trim: true,
    maxlength: [2000, 'Eligibility cannot exceed 2000 characters']
  },
  benefits: {
    type: String,
    trim: true,
    maxlength: [4000, 'Benefits cannot exceed 4000 characters']
  },
  documentsRequired: {
    type: [{
      type: String,
      trim: true,
      maxlength: [200, 'Document name too long']
    }],
    default: []
  },
  registrationCount: {
    type: Number,
    default: 0,
    min: 0
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  registrationFee: {
    type: Number,
    default: 0,
    min: [0, 'Registration fee cannot be negative']
  },
  isPaidEvent: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department cannot exceed 100 characters'],
    default: ''
  },
  schemeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme',
    default: null
  },
  sourceType: {
    type: String,
    enum: {
      values: ['Central', 'State', 'Local'],
      message: 'Source type must be Central, State or Local'
    },
    default: 'Local'
  },
  eventFormat: {
    type: String,
    enum: {
      values: ['offline', 'online', 'hybrid'],
      message: 'Event format must be offline, online or hybrid'
    },
    default: 'offline'
  },
  targetAudience: {
    type: [String],
    default: []
  },
  ward: {
    type: String,
    trim: true,
    maxlength: [100, 'Ward cannot exceed 100 characters'],
    default: ''
  },
  district: {
    type: String,
    trim: true,
    maxlength: [100, 'District cannot exceed 100 characters'],
    default: ''
  },
  state: {
    type: String,
    trim: true,
    maxlength: [100, 'State cannot exceed 100 characters'],
    default: ''
  },
  contactInfo: {
    type: String,
    trim: true,
    maxlength: [500, 'Contact information cannot exceed 500 characters'],
    default: ''
  },
  reminderNotifiedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

eventSchema.index({ organizer: 1, status: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ eventDate: 1 });
eventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Event', eventSchema);
