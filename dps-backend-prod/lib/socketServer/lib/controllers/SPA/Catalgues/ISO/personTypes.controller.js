const db = require("../../../../sequelize/init");
const express = require('express');
const { validate, Joi } = require("express-validation");
const router = express.Router();

tipoPersonaSchema = {
    body: Joi.object({
      name: Joi.string().max(50)
        .required()
        .external(async (value, helpers) => {
            const count = await db.tipoPersona.count({where: { name: value }});
            if(count > 0){
                return helpers.message(`${value} already exists.`);
            }
            return value;
        })
    }),
};

router.get('/', async (req, res) => {
    try {
      const pageSize = parseInt(req.query.pageSize) ?? 10;
      const page = ((parseInt(req.query.page) ?? 1) - 1);
      const query = await db.tipoPersona.findAndCountAll(
          {
              limit: pageSize,
              offset: pageSize * page
          }
      );
  
      return res.json({
        data: query.rows,
        pagination:{
          total: query.count,
          page: page + 1,
          pageSize,
          pages: Math.ceil(query.count/pageSize)
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error })
    }
});

router.get('/:id', async (req, res) => {
    try {
        const person = await db.tipoPersona.findByPk(req.params.id);
        if(person){
            return res.json(person);
        }else{
            return res.status(404).json({error: `ID: ${req.params.id}, not found`});
        }
    
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error })
      }
});

router.post('/', async (req, res) => {
    try{

        const row = await db.tipoPersona.findOne({where: { name: req.body.name }})

        if(row){
            return res.status(400).json({ message : "El tipo de persona, ya se encuentra en uso" });
        }

       const item =  (await db.tipoPersona.upsert({
            ...req.body
        }))?.[0];

        return res.json({ status:'ok', response: `${item.name} added!`, id: item.id_tipo_persona });
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});

router.delete('/:id', async (req, res) => {
    try{
       const affected = await db.tipoPersona.destroy({where:{ id_tipo_persona: req.params.id }});
       if(affected > 0){
        return res.json({ status:'ok', response: `ID: ${req.params.id} deleted!`});
       }

       return res.status(404).json({error: `ID: ${req.params.id}, not found`});
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});

router.put('/:id', async (req, res) => {
    try{

        const exist = await db.tipoPersona.findByPk(req.params.id);

        if(!exist){
            return res.status(404).json({error: `ID: ${req.params.id}, not found`});
        }

        const row = await db.tipoPersona.findOne({where: { name: req.body.name }})

        if(row && row.id_tipo_persona != req.params.id){
            return res.status(400).json({ message : "El tipo de persona, ya se encuentra en uso" });
        }

        await db.tipoPersona.update({
            ...req.body
        }, {where:{ id_tipo_persona: req.params.id }})

        return res.json({ status:'ok', response: `ID: ${req.params.id} updated!`, id: req.params.id});

    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});





module.exports = router;