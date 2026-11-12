module.exports = async (db) => {

  let data = [
    {id:1 , status:'Pendiente' },
    {id:2 , status:'Por Liquidar'},
    {id:3 , status:'Liquidado'},
  ];

  let newValues = [];
  for (const value of data) {
    const r = await db.catStatusF.findOne({where:{id: value.id}});
    if(r){
      r.status    = value.status;
      await r.save();
    }else{
      newValues.push(value);
    }
  }

  return db.catStatusF.bulkCreate(newValues);
}