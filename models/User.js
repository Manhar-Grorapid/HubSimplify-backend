const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({

    userId: {
        type: String,
        required: true,
    },

    refreshToken: {
        type: String,
        required: true,
    },

    portalId: {
        type: String,
        required: true,
    },

});

module.exports =
    mongoose.model(
        "User",
        UserSchema
    );