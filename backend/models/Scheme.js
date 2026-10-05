const mongoose = require('mongoose');
const { SOURCE_TYPES, ELIGIBILITY_TAGS, INDIAN_STATES } = require('../constants/schemeConstants');

// This structure is reserved for future profile-based eligibility checks.
// It complements the existing descriptive text and discovery tags.
const eligibilityRulesSchema = new mongoose.Schema({
  minAge: { type: Number, min: 0, max: 120 },
  maxAge: { type: Number, min: 0, max: 120 },
  maxAnnualIncome: { type: Number, min: 0 },
  genders: [{ type: String, enum: ['Male', 'Female', 'Other'] }],
  states: [{ type: String, enum: INDIAN_STATES }],
  socialCategories: [{ type: String, trim: true, maxlength: 80 }],
  occupations: [{ type: String, trim: true, maxlength: 80 }]
}, { _id: false });

const schemeSchema = new mongoose.Schema({
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

  sourceType: {
    type: String,
    trim: true,
    uppercase: true,
    enum: {
      values: SOURCE_TYPES,
      message: `Source type must be one of: ${SOURCE_TYPES.join(', ')}`
    },
    default: 'CENTRAL',
    required: function () {
      return this.isNew;
    },
    index: true
  },

  state: {
    type: String,
    trim: true,
    maxlength: [60, 'State name cannot exceed 60 characters'],
    validate: {
      validator: function (val) {
        if (!val) return true;
        if (this.sourceType !== 'STATE') {
          return val === '' || val == null;
        }
        return INDIAN_STATES.includes(val);
      },
      message: (props) =>
        `State is required for STATE schemes and must be a valid Indian state. Got: "${props.value}"`
    },
    index: true
  },

  officialURL: {
    type: String,
    trim: true,
    maxlength: [500, 'Official URL cannot exceed 500 characters'],
    validate: {
      validator: function (val) {
        if (!val) return true;
        return /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i.test(val);
      },
      message: 'Official URL must be a valid URL starting with http:// or https://'
    }
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

  status: {
    type: String,
    trim: true,
    enum: {
      values: ['Active', 'Inactive', 'Draft'],
      message: 'Status must be Active, Inactive or Draft'
    },
    default: 'Active',
    index: true
  },

  eligibility: {
    type: String,
    trim: true,
    minlength: [5, 'Eligibility must be at least 5 characters'],
    maxlength: [2000, 'Eligibility cannot exceed 2000 characters'],
    required: function () {
      return this.isNew;
    }
  },

  eligibilityTags: {
    type: [{
      type: String,
      trim: true,
      enum: {
        values: ELIGIBILITY_TAGS,
        message: `Invalid eligibility tag: '{VALUE}'`
      }
    }],
    default: [],
    index: true
  },

  eligibilityRules: {
    type: eligibilityRulesSchema,
    default: () => ({})
  },

  documentsRequired: {
    type: [{
      type: String,
      trim: true,
      maxlength: [200, 'Document name too long']
    }],
    default: [],
    validate: {
      validator: function (arr) {
        return arr.length <= 30;
      },
      message: 'Maximum 30 documents allowed'
    }
  },

  benefits: {
    type: String,
    trim: true,
    minlength: [5, 'Benefits must be at least 5 characters'],
    maxlength: [4000, 'Benefits cannot exceed 4000 characters'],
    required: function () {
      return this.isNew;
    }
  },

  applyCount: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },

  endDate: {
    type: Date,
    default: null,
    index: true
  },

  expiryNotifiedAt: {
    type: Date,
    default: null
  },

  deadlineNotifiedAt: {
    type: Date,
    default: null
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});


// 🔥 INDEXES
schemeSchema.index({ title: 1, category: 1 }, { unique: true });
schemeSchema.index({ category: 1 });
schemeSchema.index({ createdAt: -1 });
schemeSchema.index({ sourceType: 1, state: 1 });


// 🔥 VIRTUALS
schemeSchema.virtual('formattedCreatedAt').get(function () {
  return this.createdAt
    ? new Date(this.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : null;
});

schemeSchema.virtual('formattedUpdatedAt').get(function () {
  return this.updatedAt
    ? new Date(this.updatedAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : null;
});


// 🔥 SOURCE TYPE UPPERCASE + BACKWARD COMPATIBILITY FIX
schemeSchema.pre('save', function () {
  if (this.sourceType) {
    const normalized = String(this.sourceType)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/_GOVT$/, '')
      .replace(/_GOVERNMENT$/, '');
    if (normalized === 'CENTRAL' || normalized === 'STATE') {
      this.sourceType = normalized;
    }
  }
  if (!this.sourceType) this.sourceType = 'CENTRAL';
  if (this.sourceType !== 'STATE') {
    this.state = '';
  }
  if (!this.eligibility) this.eligibility = 'Not specified';
  if (!this.benefits) this.benefits = 'Not specified';
 
});

schemeSchema.pre('validate', function () {
  if (this.sourceType && typeof this.sourceType === 'string') {
    const raw = String(this.sourceType).trim().toUpperCase();
    if (raw.includes('CENTRAL')) this.sourceType = 'CENTRAL';
    else if (raw.includes('STATE')) this.sourceType = 'STATE';
    else if (raw === 'CENTRAL' || raw === 'STATE') this.sourceType = raw;
  }
  
});


module.exports = mongoose.model('Scheme', schemeSchema);
