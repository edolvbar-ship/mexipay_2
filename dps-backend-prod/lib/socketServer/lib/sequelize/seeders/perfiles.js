module.exports = async (db) => {
    // Define an array of profile data with id, profile name, admin and root flags
    let data = [
        {id: 1, profile_name: 'Desarrollo', admin: 1, root: 1}, // Development profile with admin and root access
        {id: 2, profile_name: 'Usuario', admin: 0, root: 0}, // Basic user profile with no special privileges
        {id: 3, profile_name: 'Administrador', admin: 1, root: 0}, // Admin profile with admin but no root access
    ];

    // Array to store new profile records that need to be created
    let newValues = [];

    // Loop through each profile in the data array
    for (const value of data) {
        // Check if profile with given id already exists in database
        const r = await db.profileUsers.findOne({where: {id: value.id}});
        if (r) {
            // If profile exists, update its values
            r.profile_name = value.profile_name;
            r.admin = value.admin;
            r.root = value.root;
            await r.save();
        } else {
            // If profile doesn't exist, add it to array of new profiles
            newValues.push(resource);
        }
    }

    // Bulk create any new profiles and return the result
    return db.profileUsers.bulkCreate(newValues);
}