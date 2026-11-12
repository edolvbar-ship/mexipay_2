const db = require("../../../../sequelize/init");
const express = require('express');
const { validate, Joi } = require("express-validation");
const router = express.Router();

createValidationSchema = {
    body: Joi.object({
      schema: Joi.string()
        .required()
        .max(45)
        .external(async (value, helpers) => {
            const count = await model.count({where: { esquema: value }});
            if(count > 0){
                return helpers.message(`${value} ya se encuentra en uso.`);
            }
            return value;
        }),
        description: Joi.string().max(45).required()
    }),
};

updateValidationSchema = {
    body: Joi.object({
      schema: Joi.string().max(45)
        .external(async (value, helpers) => {
            if(value){
                const count = await model.count({where: { esquema: value }});
                if(count > 0){
                    return helpers.message(`${value} ya se encuentra en uso.`);
                }
            }
            return value;
        }),
        description: Joi.string().max(45)
    }),
};

const model = db.isoEsquemaTrans;

router.get('/', async (req, res) => {
    try {
      const pageSize = parseInt(req.query.pageSize) ?? 10;
      const page = ((parseInt(req.query.page) ?? 1) - 1);
      const query = await model.findAndCountAll(
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
        const entity = await model.findByPk(req.params.id);
        if(entity){
            return res.json(entity);
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

        const schemaRow = await model.findOne({
            where: {
                esquema: req.body.schema
            }
        });

        if(schemaRow){
            return res.status(404).json({ status:'fail', message : `${req.body.schema} ya se encuentra en uso.` });
        }

        const item =  (await model.upsert({
            ...req.body,
            esquema: req.body.schema
        }))?.[0];

        return res.json({ status:'ok', response: `${item.esquema} added!`, id: item.id_esquema_transactional });
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});

router.delete('/:id', async (req, res) => {
    try{
       const affected = await model.destroy({where:{ id_esquema_transactional: req.params.id }});
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

        const exist = await model.findByPk(req.params.id);
        
        if(!exist){
            return res.status(404).json({error: `ID: ${req.params.id}, not found`});
        }
        
        const schemaRow = await model.findOne({
            where: {
                esquema: req.body.schema
            }
        });

        if(schemaRow && schemaRow.id_esquema_transactional != req.params.id){
            return res.status(404).json({ status:'fail', message : `${req.body.schema} ya se encuentra en uso.` });
        }

        await model.update({
            ...req.body,
            esquema: req.body.schema
        }, {where:{ id_esquema_transactional: req.params.id }})

        return res.json({ status:'ok', response: `ID: ${req.params.id} saved!`, id: req.params.id});
        
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});





module.exports = router;