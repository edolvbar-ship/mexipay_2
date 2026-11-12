const db = require("../../../../sequelize/init");
const express = require('express');
const { validate, Joi } = require("express-validation");
const router = express.Router();

createValidationSchema = {
    body: Joi.object({
      url: Joi.string()
        .required().max(50)
        .external(async (value, helpers) => {
            const count = await model.count({where: { url: value }});
            if(count > 0){
                return helpers.message(`${value} already exists.`);
            }
            return value;
        })
    }),
};

updateValidationSchema = {
    body: Joi.object({
      url: Joi.string().max(50)
        .external(async (value, helpers) => {
            if(value){
                const count = await model.count({where: { url: value }});
                if(count > 0){
                    return helpers.message(`${value} already exists.`);
                }
            }
            return value;
        }),
        idProcessor: Joi.number().integer()
        .external(async (value, helpers) => {
            if(value){
                const processor = await db.isoProcessor.findByPk(value);
                if(!processor){
                    return helpers.error('any.invalid');
                }
            }
            return value;
        })
    }),
};

const model = db.bnrgUrlDest;

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

        const procesor = await db.isoProcessor.findOne({
            where: { fiid : 'BNRG' }
         });

        if(!procesor){
            return res.status(404).json({ status:'fail', response: "No se ha encontrado el procesador" });
        }

        const item =  (await model.upsert({
            ...req.body,
            id_iso_processor: procesor.id_processor
        }))?.[0];

        return res.json({ status:'ok', response: `${item.url} added!`, id: item.id_bnrg_url_dest });
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});

router.delete('/:id', async (req, res) => {
    try{
       const affected = await model.destroy({where:{ id_bnrg_url_dest: req.params.id }});
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

        const procesor = await db.isoProcessor.findOne({
            where: { fiid : 'BNRG' }
        });

        if(!procesor){
            return res.status(404).json({ status:'fail', response: "No se ha encontrado el procesador" });
        }

        await model.update({
            ...req.body,
            id_iso_processor: procesor.id_processor
        }, {where:{ id_bnrg_url_dest: req.params.id }})

        return res.json({ status:'ok', response: `ID: ${req.params.id} saved!`, id: req.params.id});
        
    } catch(error){
        console.error(error);
        return res.status(500).json({ error })
    }
});





module.exports = router;