const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
        sparse: true,
        index: true
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    course: {
        type: String,
        required: [true, 'Course is required'],
        trim: true
    },
    semester: {
        type: Number,
        required: [true, 'Semester is required'],
        min: [1, 'Semester must be at least 1']
    }
}, {
    timestamps: true,
    versionKey: false
});

// Auto-assign sequential integer ID if not present, ensuring backward compatibility with Lab 3
studentSchema.pre('save', async function () {
    if (this.isNew && (this.id === undefined || this.id === null)) {
        const highestStudent = await this.constructor.findOne({}, {}, { sort: { id: -1 } });
        this.id = (highestStudent && highestStudent.id) ? highestStudent.id + 1 : 1;
    }
});

// Ensure `id` is accessible as string or number in JSON responses
studentSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        if (!ret.id && ret._id) {
            ret.id = ret._id.toString();
        }
        return ret;
    }
});

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
