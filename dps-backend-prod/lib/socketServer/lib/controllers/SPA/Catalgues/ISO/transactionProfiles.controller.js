const db = require("../../../../sequelize/init");
const express = require('express');
const { validate, Joi } = require("express-validation");
const router = express.Router();

const helpers = require("../../../../lib/helpers");

createValidationSchema = {
    body: Joi.object({
      name: Joi.string()
        .max(50)
        .required()
        .external(async (value, helpers) => {
            const count = await model.count({where: { name: value }});
            if(count > 0){
                return helpers.message(`${value} already exists.`);
            }
            return value;
        }),
        hexValue: Joi.string().required().max(14)
    }),
};

updateValidationSchema = {
    body: Joi.object({
      name: Joi.string()
        .max(50)
        .external(async (value, helpers) => {
            if(value){
                const count = await model.count({where: { name: value }});
                if(count > 0){
                    return helpers.message(`${value} already exists.`);
                }
            }
            return value;
        }),
        hexValue: Joi.string().max(14)
    }),
};

const model = db.isoProfileTrans;

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
  
      for (let row of query.rows) {
        row.setDataValue('decoded', await helpers.decript_bitmap_profile(row.hex_value));
      }

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
            const bitMap = await helpers.decript_bitmap_profile(entity.hex_value);
            return res.json({ success: true, data : entity,  bitMap});
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
            hex_value: req.body.hexValue
        }))?.[0];

        return res.json({ status:'ok', response: `${item.name} added!`, id: item.id_profile_transaction });
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});

router.delete('/:id', async (req, res) => {
    try{
       const affected = await model.destroy({where:{ id_profile_transaction: req.params.id }});
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

        const row = await model.findByPk(req.params.id);

        if(!row){
            return res.status(404).json({error: `ID: ${req.params.id}, not found`});
        }

        await model.update({
            ...req.body,
            hex_value: req.body.hexValue
        }, {where:{ id_profile_transaction: req.params.id }});

        return res.json({ status:'ok', response: `ID: ${req.params.id} saved!`, id: req.params.id});
              
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});





module.exports = router;