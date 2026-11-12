module.exports = async (db) => {

  let data = [
    // PERFIL ADMINISTRADOR
    {id_profile: 1,id_resource: 1 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 41 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 2 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 3 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 4 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 5 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 6 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 7 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 8 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 9 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 10 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 11 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 12 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 13 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 14 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 15 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 16 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 17 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 18 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 19 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 20 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 21 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 22 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 23 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 24 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 25 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 26 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 27 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 28 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 29 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 30 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 31 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 32 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 33 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 34 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 35 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 36 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 37 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 38 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 39 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 1,id_resource: 40 , create:1,edit:1,delete:1,select:1 },


    // PROFILE USER
    {id_profile: 2,id_resource: 1 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 2,id_resource: 2 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 2,id_resource: 19 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 2,id_resource: 20 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 2,id_resource: 21 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 2,id_resource: 22 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 2,id_resource: 23 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 2,id_resource: 24 , create:1,edit:1,delete:1,select:1 },
    {id_profile: 2,id_resource: 25 , create:1,edit:1,delete:1,select:1 },
   ];

  //
  await db.profileResources.destroy({ truncate: true });
  return db.profileResources.bulkCreate(data);
}