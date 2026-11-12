const db = require("../../../../sequelize/init");
const express = require('express');
const { validate, Joi } = require("express-validation");
const router = express.Router();

createValidationSchema = {
    body: Joi.object({
        logicalName: Joi.string()
        .max(7)
        .required()
        .external(async (value, helpers) => {
            const count = await model.count({where: { logicalName: value }});
            if(count > 0){
                return helpers.message(`${value} ya se encuentra en uso.`);
            }
            return value;
        }),
        name: Joi.string().required().max(50)
    }),
};

updateValidationSchema = {
    body: Joi.object({
        name: Joi.string().max(50)
    }),
};

const model = db.isoAggregator;

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

router.post('/',validate(createValidationSchema), async (req, res) => {
    try{
       const item =  (await model.upsert({
            ...req.body,
        }))?.[0];

        item.restore();

        return res.json({ status:'ok', response: `${item.name} added!`, id: item.logicalName });
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});

router.delete('/:id', async (req, res) => {
    try{
       const affected = await model.destroy({where:{ id: req.params.id }});
       if(affected > 0){
        return res.json({ status:'ok', response: `ID: ${req.params.id} deleted!`});
       }

       return res.status(404).json({error: `ID: ${req.params.id}, not found`});
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});

router.put('/:id',validate(updateValidationSchema), async (req, res) => {
    try{

        const exist = await model.findByPk(req.params.id);
        
        if(!exist){
            return res.status(404).json({error: `ID: ${req.params.id}, not found`});
        }

       await model.update({
            ...req.body
        }, {where:{ id: req.params.id }});

        return res.json({ status:'ok', response: `ID: ${req.params.id} saved!`, id: req.params.id});
        
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});

module.exports = router;