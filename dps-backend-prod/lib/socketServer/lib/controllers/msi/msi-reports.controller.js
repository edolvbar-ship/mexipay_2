// MSI Reports Controller
// Handles MSI analytics and reporting

const db = require('../../sequelize/init');
const { Op } = require('sequelize');

class MsiReportsController {
  // POST /api/msi-reports/generate - Generate MSI report
  static async generateReport(req, res) {
    try {
      const { startDate, endDate, reportType, groupBy } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include end date fully

      // Get MSI transactions within date range
      const whereClause = {
        creation_date: {
          [Op.between]: [start, end]
        },
        // Filter for MSI transactions based on available fields
        [Op.or]: [
          { more_info: { [Op.like]: '%MSI%' } },
          { more_info: { [Op.like]: '%Meses Sin Intereses%' } },
          { more_info: { [Op.like]: '%meses sin intereses%' } }
        ]
      };

      const transactions = await db.isoMessage.findAll({
        where: whereClause,
        include: [{
          model: db.merchant,
          as: 'merchant',
          attributes: ['id_merchant', 'name_merchant']
        }],
        order: [['creation_date', 'DESC']]
      });

      // Process transactions for report
      const reportData = await MsiReportsController.processTransactionsForReport(transactions, start, end, reportType, groupBy);

      res.json(reportData);
    } catch (error) {
      console.error('Error generating MSI report:', error);
      res.status(500).json({ 
        error: 'Error generating MSI report',
        details: error.message 
      });
    }
  }

  // Helper method to extract MSI plan from more_info field
  static extractMsiPlan(moreInfo) {
    if (!moreInfo) return 0;
    
    // Look for MSI patterns in the more_info field
    const patterns = [
      /(\d+)\s*meses?\s*si/i,
      /msi\s*(\d+)/i,
      /meses?\s*sin\s*intereses?\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = moreInfo.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    
    return 0;
  }

  // Helper method to mask card numbers
  static maskCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 4) {
      return '****';
    }
    
    // Show last 4 digits only
    return '**** **** **** ' + cardNumber.slice(-4);
  }

  // Helper method to process transactions for report
  static async processTransactionsForReport(transactions, startDate, endDate, reportType, groupBy) {
    const approvedTransactions = transactions.filter(t => t.resp_code === '00');
    const rejectedTransactions = transactions.filter(t => t.resp_code !== '00');

    // Calculate summary
    const summary = {
      totalMsiTransactions: transactions.length,
      totalMsiAmount: approvedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
      approvedTransactions: approvedTransactions.length,
      rejectedTransactions: rejectedTransactions.length,
      activeMerchants: new Set(transactions.map(t => t.name_merchant)).size,
      approvalRate: transactions.length > 0 ? (approvedTransactions.length / transactions.length) * 100 : 0,
      averageAmount: approvedTransactions.length > 0 ? 
        approvedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) / approvedTransactions.length : 0
    };

    // Process detailed data
    const detailedData = transactions.map(transaction => ({
      date: transaction.creation_date,
      merchantName: transaction.merchant?.name_merchant || 'Unknown',
      operationName: 'Venta', // Default operation type
      msiPlan: MsiReportsController.extractMsiPlan(transaction.more_info) || 0,
      amount: parseFloat(transaction.amount || 0),
      status: transaction.resp_code === '00' ? 'approved' : 'rejected',
      cardNumber: MsiReportsController.maskCardNumber(transaction.bin || '')
    }));

    // Generate analytics
    const analytics = {
      msiPlansDistribution: MsiReportsController.calculateMsiPlansDistribution(transactions),
      binAnalysis: MsiReportsController.calculateBinAnalysis(transactions),
      hourlyPerformance: MsiReportsController.calculateHourlyPerformance(transactions, startDate, endDate, groupBy),
      rejectionReasons: MsiReportsController.calculateRejectionReasons(rejectedTransactions),
      performance: {
        averageResponseTime: 245, // Placeholder - would need actual response time data
        approvalRate: summary.approvalRate,
        errorRate: transactions.length > 0 ? (rejectedTransactions.length / transactions.length) * 100 : 0,
        throughput: Math.round(transactions.length / ((endDate - startDate) / (1000 * 60 * 60 * 24))) // transactions per day
      }
    };

    return {
      summary,
      detailedData,
      analytics,
      period: {
        startDate,
        endDate,
        reportType: reportType || 'usage',
        groupBy: groupBy || 'day'
      }
    };
  }

  // Calculate MSI plans distribution
  static calculateMsiPlansDistribution(transactions) {
    const plansCount = {};
    
    transactions.forEach(transaction => {
      const plan = MsiReportsController.extractMsiPlan(transaction.more_info) || 0;
      if (plan > 0) {
        const key = `${plan} meses`;
        plansCount[key] = (plansCount[key] || 0) + 1;
      }
    });

    const total = Object.values(plansCount).reduce((sum, count) => sum + count, 0);
    return Object.entries(plansCount).map(([plan, count]) => ({
      plan,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    })).sort((a, b) => a.count - b.count);
  }

  // Calculate BIN analysis
  static calculateBinAnalysis(transactions) {
    const binRanges = {
      '400000-499999': 0,
      '510000-559999': 0,
      '340000-349999': 0,
      'Other': 0
    };

    const binAmounts = {
      '400000-499999': 0,
      '510000-559999': 0,
      '340000-349999': 0,
      'Other': 0
    };

    transactions.forEach(transaction => {
      const bin = (transaction.bin || '').substring(0, 6);
      let range = 'Other';
      
      if (bin >= '400000' && bin <= '499999') range = '400000-499999';
      else if (bin >= '510000' && bin <= '559999') range = '510000-559999';
      else if (bin >= '340000' && bin <= '349999') range = '340000-349999';
      
      binRanges[range]++;
      binAmounts[range] += parseFloat(transaction.amount || 0);
    });

    const total = transactions.length;
    return Object.entries(binRanges).map(([range, count]) => ({
      range,
      transactionCount: count,
      totalAmount: binAmounts[range],
      percentage: total > 0 ? (count / total) * 100 : 0
    })).filter(item => item.count > 0);
  }

  // Calculate hourly performance
  static calculateHourlyPerformance(transactions, startDate, endDate, groupBy) {
    const hourlyData = [];
    
    if (groupBy === 'hour') {
      // Group by hour
      for (let hour = 0; hour < 24; hour++) {
        const hourTransactions = transactions.filter(t => {
          const transactionHour = new Date(t.creation_date).getHours();
          return transactionHour === hour;
        });
        
        hourlyData.push({
          hour: `${hour.toString().padStart(2, '0')}:00`,
          transactions: hourTransactions.length,
          amount: hourTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
        });
      }
    } else {
      // Group by day (default)
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      for (let i = 0; i <= daysDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        currentDate.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayTransactions = transactions.filter(t => {
          const transactionDate = new Date(t.creation_date);
          return transactionDate >= currentDate && transactionDate < nextDate;
        });
        
        hourlyData.push({
          hour: currentDate.toLocaleDateString('es-MX'),
          transactions: dayTransactions.length,
          amount: dayTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
        });
      }
    }

    return hourlyData;
  }

  // Calculate rejection reasons
  static calculateRejectionReasons(rejectedTransactions) {
    const reasonsCount = {};
    
    rejectedTransactions.forEach(transaction => {
      const reason = transaction.resp_code || 'Unknown';
      reasonsCount[reason] = (reasonsCount[reason] || 0) + 1;
    });

    const total = rejectedTransactions.length;
    return Object.entries(reasonsCount).map(([reason, count]) => ({
      reason,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    })).sort((a, b) => b.count - a.count);
  }

  // Helper method to mask card numbers
  static maskCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 4) return '****';
    return `**** **** **** ${cardNumber.slice(-4)}`;
  }

  // GET /api/msi-reports/summary - Get MSI summary statistics
  static async getSummary(req, res) {
    try {
      const { period = '30' } = req.query; // Default to last 30 days
      const daysAgo = parseInt(period);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const whereClause = {
        creation_date: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { more_info: { [Op.like]: '%MSI%' } },
          { more_info: { [Op.like]: '%Meses Sin Intereses%' } },
          { more_info: { [Op.like]: '%meses sin intereses%' } }
        ]
      };

      const transactions = await db.isoMessage.findAll({
        where: whereClause,
        attributes: ['amount', 'resp_code', 'more_info', 'name_merchant']
      });

      const approvedTransactions = transactions.filter(t => t.resp_code === '00');
      const uniqueMerchants = new Set(transactions.map(t => t.name_merchant));

      const summary = {
        period: `${daysAgo} days`,
        totalTransactions: transactions.length,
        totalAmount: approvedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
        approvedTransactions: approvedTransactions.length,
        uniqueMerchants: uniqueMerchants.size,
        approvalRate: transactions.length > 0 ? (approvedTransactions.length / transactions.length) * 100 : 0,
        averageAmount: approvedTransactions.length > 0 ? 
          approvedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) / approvedTransactions.length : 0
      };

      res.json(summary);
    } catch (error) {
      console.error('Error getting MSI summary:', error);
      res.status(500).json({ 
        error: 'Error getting MSI summary',
        details: error.message 
      });
    }
  }
}

module.exports = MsiReportsController;
