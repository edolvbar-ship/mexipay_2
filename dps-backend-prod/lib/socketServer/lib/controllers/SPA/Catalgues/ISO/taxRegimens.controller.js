const db        = require("../../../../sequelize/init");
const express   = require('express');
const router    =  express.Router();

const model     = db.taxRegimen;

router.get('/', async (req, res) => {

    try {
      const pageSize = parseInt(req.query.pageSize) ?? 10;
      const page = ((parseInt(req.query.page) ?? 1) - 1);
      const query = await model.findAndCountAll(
          { 
            limit: pageSize,
            offset: pageSize * page,
            order : [
              [ 'is_moral', 'desc']
            ] 
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

module.exports = router;