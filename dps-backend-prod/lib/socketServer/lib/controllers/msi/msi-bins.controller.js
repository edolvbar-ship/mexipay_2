// MSI BIN Management Controller
// Handles Mexican BIN range management for MSI eligibility

const db = require('../../sequelize/init');

class MsiBinsController {
  
  /**
   * Get all national BIN ranges for MSI
   */
  static async getNationalBins(req, res) {
    try {
      console.log('[MSI Bins] Getting national BIN ranges');
      
      const [binRanges] = await db.seq.query(`
        SELECT * FROM msi_bin_ranges 
        WHERE active = 1 AND country_code = 'MX'
        ORDER BY card_brand ASC, bin_start ASC
      `);
      
      res.json(binRanges.map(range => ({
        id_msi_bin: range.id_msi_bin,
        bin_start: range.bin_start,
        bin_end: range.bin_end,
        bank_name: range.bank_name,
        card_brand: range.card_brand,
        country_code: "MX",
        active: range.active ? true : false
      })));
      
    } catch (error) {
      console.error('[MSI Bins] Error getting national BINs:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Add new national BIN range
   */
  static async addNationalBin(req, res) {
    try {
      const { bin_start, bin_end, bank_name, card_brand } = req.body;
      
      console.log(`[MSI Bins] Adding BIN range: ${bin_start}-${bin_end} for ${bank_name}`);
      
      // Validate input
      if (!bin_start || !bin_end || !bank_name || !card_brand) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: bin_start, bin_end, bank_name, card_brand'
        });
      }
      
      // Validate BIN format
      if (!/^\d{6}$/.test(bin_start) || !/^\d{6}$/.test(bin_end)) {
        return res.status(400).json({
          success: false,
          error: 'BIN ranges must be 6 digits'
        });
      }
      
      // Validate card brand
      const validBrands = ['Visa', 'Mastercard', 'Amex', 'Discover'];
      if (!validBrands.includes(card_brand)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid card brand. Must be: Visa, Mastercard, Amex, or Discover'
        });
      }
      
      // Check for overlapping ranges
      const [existingRange] = await db.seq.query(`
        SELECT * FROM msi_bin_ranges 
        WHERE active = 1 AND card_brand = '${card_brand}'
        AND (bin_start <= '${bin_start}' AND bin_end >= '${bin_start}'
             OR bin_start <= '${bin_end}' AND bin_end >= '${bin_end}'
             OR bin_start >= '${bin_start}' AND bin_end <= '${bin_end}')
        LIMIT 1
      `);
      
      if (existingRange) {
        return res.status(400).json({
          success: false,
          error: 'BIN range overlaps with existing range'
        });
      }
      
      // Create new BIN range
      const [result] = await db.seq.query(`
        INSERT INTO msi_bin_ranges (bin_start, bin_end, bank_name, card_brand, country_code, active, created_at, updated_at)
        VALUES ('${bin_start}', '${bin_end}', '${bank_name}', '${card_brand}', 'MX', 1, NOW(), NOW())
      `);
      
      console.log(`[MSI Bins] Successfully added BIN range: ${result}`);
      
      res.status(201).json({
        id_msi_bin: result,
        bin_start: bin_start,
        bin_end: bin_end,
        bank_name: bank_name,
        card_brand: card_brand,
        country_code: 'MX',
        active: true,
        created_at: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('[MSI Bins] Error adding BIN range:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
  
  /**
   * Remove national BIN range
   */
  static async removeNationalBin(req, res) {
    try {
      const { id_msi_bin } = req.params;
      
      console.log(`[MSI Bins] Removing BIN range: ${id_msi_bin}`);
      
      const [binRange] = await db.seq.query(`
        SELECT * FROM msi_bin_ranges WHERE id_msi_bin = ${id_msi_bin} AND active = 1
      `);
      
      if (!binRange || binRange.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'BIN range not found'
        });
      }
      
      // Soft delete by setting active to false
      await db.seq.query(`
        UPDATE msi_bin_ranges SET active = 0, updated_at = NOW() 
        WHERE id_msi_bin = ${id_msi_bin}
      `);
      
      console.log(`[MSI Bins] Successfully removed BIN range: ${id_msi_bin}`);
      
      res.status(204).send();
      
    } catch (error) {
      console.error('[MSI Bins] Error removing BIN range:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Check BIN eligibility for MSI
   */
  static async checkBinEligibility(req, res) {
    try {
      const { bin } = req.body;
      
      console.log(`[MSI Bins] Checking BIN eligibility: ${bin}`);
      
      if (!bin || bin.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Valid BIN (6 digits) required'
        });
      }
      
      // Check against national BIN ranges
      const bin6 = bin.substring(0, 6);
      const [binRange] = await db.seq.query(`
        SELECT * FROM msi_bin_ranges 
        WHERE active = 1 AND country_code = 'MX'
        AND '${bin6}' BETWEEN bin_start AND bin_end
        LIMIT 1
      `);
      
      console.log(`[MSI Bins] Query result for ${bin6}:`, binRange);
      
      const isEligible = binRange && binRange.length > 0;
      const rangeData = isEligible ? binRange[0] : null;
      
      console.log(`[MSI Bins] rangeData:`, rangeData);
      
      res.json({
        success: true,
        data: {
          bin: bin6,
          is_eligible: isEligible,
          is_mexican: isEligible,
          bin_info: rangeData ? {
            id_msi_bin: rangeData.id_msi_bin,
            bank_name: rangeData.bank_name,
            card_brand: rangeData.card_brand,
            range: `${rangeData.bin_start}-${rangeData.bin_end}`
          } : null
        }
      });
      
    } catch (error) {
      console.error('[MSI Bins] Error checking BIN eligibility:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Update BIN range
   */
  static async updateBinRange(req, res) {
    try {
      const { id_msi_bin } = req.params;
      const { bank_name, card_brand, active } = req.body;
      
      console.log(`[MSI Bins] Updating BIN range: ${id_msi_bin}`);
      
      const [binRange] = await db.seq.query(`
        SELECT * FROM msi_bin_ranges WHERE id_msi_bin = ${id_msi_bin}
      `);
      
      if (!binRange || binRange.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'BIN range not found'
        });
      }
      
      const current = binRange[0];
      
      // Update fields
      const updates = {};
      if (bank_name !== undefined) updates.bank_name = bank_name;
      if (card_brand !== undefined) {
        const validBrands = ['Visa', 'Mastercard', 'Amex', 'Discover'];
        if (!validBrands.includes(card_brand)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid card brand'
          });
        }
        updates.card_brand = card_brand;
      }
      if (active !== undefined) updates.active = active;
      
      // Build dynamic UPDATE query
      const updateFields = Object.keys(updates).map(key => `${key} = '${updates[key]}'`).join(', ');
      await db.seq.query(`
        UPDATE msi_bin_ranges SET ${updateFields}, updated_at = NOW() 
        WHERE id_msi_bin = ${id_msi_bin}
      `);
      
      console.log(`[MSI Bins] Successfully updated BIN range: ${id_msi_bin}`);
      
      res.json({
        id_msi_bin: current.id_msi_bin,
        bin_start: current.bin_start,
        bin_end: current.bin_end,
        bank_name: updates.bank_name !== undefined ? updates.bank_name : current.bank_name,
        card_brand: updates.card_brand !== undefined ? updates.card_brand : current.card_brand,
        country_code: current.country_code || 'MX',
        active: updates.active !== undefined ? Boolean(updates.active) : Boolean(current.active),
        updated_at: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('[MSI Bins] Error updating BIN range:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = MsiBinsController;
