const db = require('../config/db');

exports.updateProfile = async (req, res) => {
    const { biography, linkedin_url, image_url } = req.body;
    const userId = req.user.userId; // Provided by the authMiddleware "protect"

    try {
        // 1. URL Validation (Basic)
        if (linkedin_url && !linkedin_url.includes('linkedin.com')) {
            return res.status(400).json({ error: "Please provide a valid LinkedIn URL." });
        }

        // 2. Update the profile linked to this specific User
        const updatedProfile = await db.query(
            `UPDATE profiles 
             SET biography = $1, linkedin_url = $2, image_url = $3, is_complete = true 
             WHERE user_id = $4 
             RETURNING *`,
            [biography, linkedin_url, image_url, userId]
        );

        if (updatedProfile.rows.length === 0) {
            return res.status(404).json({ error: "Profile not found." });
        }

        res.status(200).json({
            message: "Profile updated successfully!",
            profile: updatedProfile.rows[0]
        });

    } catch (err) {
        console.error("Profile Update Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};

// Add this to your profileController.js
exports.addQualification = async (req, res) => {
    const { q_type, title, organization, url, completion_date } = req.body;
    const userId = req.user.userId;

    try {
        // 1. First, find the profile_id for this user
        const profileRes = await db.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
        if (profileRes.rows.length === 0) {
            return res.status(404).json({ error: "Profile not found." });
        }
        const profileId = profileRes.rows[0].id;

        // 2. Validate Type (Brief requires: degree, certification, licence, or course)
        const validTypes = ['degree', 'certification', 'licence', 'course'];
        if (!validTypes.includes(q_type)) {
            return res.status(400).json({ error: "Invalid qualification type." });
        }

        // 3. Insert the new qualification into the 3NF table
        const newQual = await db.query(
            `INSERT INTO qualifications (profile_id, q_type, title, organization, url, completion_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [profileId, q_type, title, organization, url, completion_date]
        );

        res.status(201).json({
            message: "Qualification added successfully!",
            qualification: newQual.rows[0]
        });

    } catch (err) {
        console.error("Qualification Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};

// Edit a qualification
exports.updateQualification = async (req, res) => {
    const { id } = req.params;
    const { q_type, title, organization, url, completion_date } = req.body;
    const userId = req.user.userId;

    try {
        // 1. Get the user's profile_id
        const profileRes = await db.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
        if (profileRes.rows.length === 0) {
            return res.status(404).json({ error: "Profile not found." });
        }
        const profileId = profileRes.rows[0].id;

        // 2. Verify this qualification belongs to the user's profile
        const qualCheck = await db.query(
            'SELECT id FROM qualifications WHERE id = $1 AND profile_id = $2',
            [id, profileId]
        );
        if (qualCheck.rows.length === 0) {
            return res.status(404).json({ error: "Qualification not found or access denied." });
        }

        // 3. Validate Type
        const validTypes = ['degree', 'certification', 'licence', 'course'];
        if (q_type && !validTypes.includes(q_type)) {
            return res.status(400).json({ error: "Invalid qualification type." });
        }

        // 4. Update the qualification
        const updatedQual = await db.query(
            `UPDATE qualifications 
             SET q_type = COALESCE($1, q_type), 
                 title = COALESCE($2, title), 
                 organization = COALESCE($3, organization), 
                 url = COALESCE($4, url), 
                 completion_date = COALESCE($5, completion_date)
             WHERE id = $6 AND profile_id = $7
             RETURNING *`,
            [q_type, title, organization, url, completion_date, id, profileId]
        );

        res.status(200).json({
            message: "Qualification updated successfully!",
            qualification: updatedQual.rows[0]
        });

    } catch (err) {
        console.error("Update Qualification Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};

// Delete a qualification
exports.deleteQualification = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        // 1. Get the user's profile_id
        const profileRes = await db.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
        if (profileRes.rows.length === 0) {
            return res.status(404).json({ error: "Profile not found." });
        }
        const profileId = profileRes.rows[0].id;

        // 2. Delete only if it belongs to the user's profile
        const deleteRes = await db.query(
            'DELETE FROM qualifications WHERE id = $1 AND profile_id = $2 RETURNING id',
            [id, profileId]
        );

        if (deleteRes.rows.length === 0) {
            return res.status(404).json({ error: "Qualification not found or access denied." });
        }

        res.status(200).json({ message: "Qualification deleted successfully!" });

    } catch (err) {
        console.error("Delete Qualification Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};

// Upload profile image
exports.uploadProfileImage = async (req, res) => {
    const userId = req.user.userId;

    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided." });
        }

        // Generate the image URL path
        const imageUrl = `/uploads/${req.file.filename}`;

        // Update the profile with the new image URL
        const updatedProfile = await db.query(
            'UPDATE profiles SET image_url = $1 WHERE user_id = $2 RETURNING *',
            [imageUrl, userId]
        );

        if (updatedProfile.rows.length === 0) {
            return res.status(404).json({ error: "Profile not found." });
        }

        res.status(200).json({
            message: "Profile image uploaded successfully!",
            image_url: imageUrl,
            profile: updatedProfile.rows[0]
        });

    } catch (err) {
        console.error("Upload Image Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};