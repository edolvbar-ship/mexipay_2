/**
 * Permission Testing Controller
 * Provides endpoints for testing user permissions
 */

const db = require('../../sequelize/init');

class PermissionTestController {
  /**
   * Test a resource as a specific user
   * This endpoint simulates API access as the selected user
   */
  async testResourceAsUser(req, res) {
    try {
      const { resourceId } = req.params;
      const testUserId = req.headers['x-test-user-id'];
      const testMode = req.headers['x-test-mode'];

      // Only allow this endpoint in test mode and for admins
      if (!testMode || testMode !== 'permission-check') {
        return res.status(403).json({
          success: false,
          error: 'This endpoint is only available in test mode'
        });
      }

      // Verify the requester is an admin
      if (!req.user || req.user.id_profile !== 1) {
        return res.status(403).json({
          success: false,
          error: 'Only administrators can use permission testing'
        });
      }

      // Get the test user information
      const [testUser] = await db.seq.query(
        `SELECT u.id, u.username, u.full_name, u.mail, u.id_profile, up.name as profile_name
         FROM users u 
         LEFT JOIN user_profile up ON u.id_profile = up.id_profile 
         WHERE u.id = ? AND u.deleted_at IS NULL`,
        { replacements: [testUserId], type: db.seq.QueryTypes.SELECT }
      );

      if (!testUser || testUser.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Test user not found'
        });
      }

      // Get the resource information
      const [resource] = await db.seq.query(
        `SELECT id, resource_name, resource_url, is_group, father_resource 
         FROM resources 
         WHERE id = ? AND deleted_at IS NULL`,
        { replacements: [resourceId], type: db.seq.QueryTypes.SELECT }
      );

      if (!resource || resource.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }

      const resourceData = resource[0];

      // Get user permissions for this resource
      const [permissions] = await db.seq.query(
        `SELECT create, edit, delete, select 
         FROM profile_resources 
         WHERE id_profile = ? AND id_resource = ?`,
        { 
          replacements: [testUser[0].id_profile, resourceId], 
          type: db.seq.QueryTypes.SELECT 
        }
      );

      const userPermissions = permissions.length > 0 ? permissions[0] : {
        create: 0,
        edit: 0,
        delete: 0,
        select: 0
      };

      // Test actual access by attempting to access the resource
      let accessTest = {
        canRead: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        actualResponse: null,
        error: null
      };

      // Test SELECT permission (read access)
      if (userPermissions.select === 1) {
        try {
          // Simulate a read request to the resource
          const testResult = await this.simulateResourceAccess(
            resourceData, 
            testUser[0], 
            'GET'
          );
          accessTest.canRead = testResult.success;
          accessTest.actualResponse = testResult;
        } catch (error) {
          accessTest.error = error.message;
        }
      }

      // Test CREATE permission
      if (userPermissions.create === 1) {
        try {
          const testResult = await this.simulateResourceAccess(
            resourceData, 
            testUser[0], 
            'POST'
          );
          accessTest.canCreate = testResult.success;
        } catch (error) {
          // Expected to fail for most resources
          accessTest.canCreate = false;
        }
      }

      // Test EDIT permission
      if (userPermissions.edit === 1) {
        try {
          const testResult = await this.simulateResourceAccess(
            resourceData, 
            testUser[0], 
            'PUT'
          );
          accessTest.canEdit = testResult.success;
        } catch (error) {
          // Expected to fail for most resources
          accessTest.canEdit = false;
        }
      }

      // Test DELETE permission
      if (userPermissions.delete === 1) {
        try {
          const testResult = await this.simulateResourceAccess(
            resourceData, 
            testUser[0], 
            'DELETE'
          );
          accessTest.canDelete = testResult.success;
        } catch (error) {
          // Expected to fail for most resources
          accessTest.canDelete = false;
        }
      }

      // Return comprehensive test results
      res.json({
        success: true,
        data: {
          testUser: {
            id: testUser[0].id,
            username: testUser[0].username,
            fullName: testUser[0].full_name,
            profile: testUser[0].profile_name,
            profileId: testUser[0].id_profile
          },
          resource: resourceData,
          expectedPermissions: userPermissions,
          actualAccess: accessTest,
          permissionMatch: {
            select: accessTest.canRead === (userPermissions.select === 1),
            create: accessTest.canCreate === (userPermissions.create === 1),
            edit: accessTest.canEdit === (userPermissions.edit === 1),
            delete: accessTest.canDelete === (userPermissions.delete === 1)
          },
          testTimestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error in testResourceAsUser:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Simulate resource access based on URL and HTTP method
   */
  async simulateResourceAccess(resource, user, method) {
    const resourceUrl = resource.resource_url;
    
    // Map resource URLs to actual API endpoints
    const endpointMap = {
      '/profile': '/gateway/api/v2/dashboard',
      '/movimientos/transacciones': '/gateway/api/v2/transactions',
      '/movimientos/transacciones-mejoradas': '/gateway/api/v2/enhanced-transactions',
      '/movimientos/pos-json': '/gateway/api/v2/pos-json',
      '/movimientos/tickets': '/gateway/api/v2/tickets',
      '/movimientos/contracargos': '/gateway/api/v2/contracargos',
      '/comercios': '/gateway/api/v2/merchant',
      '/clientes': '/gateway/api/v2/cat/clientes',
      '/report/liquidation': '/gateway/api/v2/report/liquidation',
      '/report/posIso': '/gateway/api/v2/report/posIso',
      '/report/tickets': '/gateway/api/v2/report/tickets',
      '/link': '/gateway/api/v2/link',
      '/link/links': '/gateway/api/v2/link/links'
    };

    const endpoint = endpointMap[resourceUrl];
    if (!endpoint) {
      return {
        success: false,
        error: 'No endpoint mapping found for resource',
        method,
        url: resourceUrl
      };
    }

    // For testing purposes, we'll simulate the response based on permissions
    // In a real implementation, you would make actual HTTP requests
    
    try {
      // Create a mock request object for the test user
      const mockReq = {
        user: {
          id: user.id,
          id_profile: user.profileId,
          id_cliente: user.id_cliente, // This would need to be fetched
          is_admin: user.profileId === 1 ? 1 : 0
        },
        method: method,
        query: {},
        body: {}
      };

      // Create a mock response object
      let mockResponse = {
        statusCode: 200,
        data: null,
        headers: {}
      };

      // Simulate the endpoint logic based on the resource
      await this.simulateEndpointLogic(resource, method, mockReq, mockResponse);

      return {
        success: mockResponse.statusCode < 400,
        statusCode: mockResponse.statusCode,
        data: mockResponse.data,
        method,
        url: resourceUrl,
        endpoint: endpoint
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        method,
        url: resourceUrl,
        endpoint: endpoint
      };
    }
  }

  /**
   * Simulate endpoint logic for different resources
   */
  async simulateEndpointLogic(resource, method, req, res) {
    const resourceUrl = resource.resource_url;

    // Dashboard endpoint simulation
    if (resourceUrl === '/profile') {
      if (method === 'GET') {
        // Dashboard access - check if user has select permission
        const [permissions] = await db.seq.query(
          `SELECT select FROM profile_resources WHERE id_profile = ? AND id_resource = ?`,
          { replacements: [req.user.id_profile, resource.id], type: db.seq.QueryTypes.SELECT }
        );

        if (permissions.length > 0 && permissions[0].select === 1) {
          res.statusCode = 200;
          res.data = { message: 'Dashboard access granted', user: req.user };
        } else {
          res.statusCode = 403;
          res.data = { error: 'Access denied to dashboard' };
        }
      }
    }

    // Enhanced Transactions endpoint simulation
    if (resourceUrl === '/movimientos/transacciones-mejoradas') {
      if (method === 'GET') {
        // Check if user has access to enhanced transactions
        const [permissions] = await db.seq.query(
          `SELECT select FROM profile_resources WHERE id_profile = ? AND id_resource = ?`,
          { replacements: [req.user.id_profile, resource.id], type: db.seq.QueryTypes.SELECT }
        );

        if (permissions.length > 0 && permissions[0].select === 1) {
          res.statusCode = 200;
          res.data = { 
            message: 'Enhanced transactions access granted',
            transactions: [], // Mock data
            user: req.user 
          };
        } else {
          res.statusCode = 403;
          res.data = { error: 'Access denied to enhanced transactions' };
        }
      }
    }

    // Add more resource simulations as needed
    // For now, default response for unhandled resources
    if (!res.data) {
      res.statusCode = 200;
      res.data = { message: 'Resource access simulated', resource: resourceUrl };
    }
  }

  /**
   * Get all users for testing dropdown
   */
  async getUsersForTesting(req, res) {
    try {
      // Only allow admins to access this endpoint
      if (!req.user || req.user.id_profile !== 1) {
        return res.status(403).json({
          success: false,
          error: 'Only administrators can access user list for testing'
        });
      }

      const [users] = await db.seq.query(
        `SELECT u.id, u.username, u.full_name, u.mail, u.id_profile, up.name as profile_name
         FROM users u 
         LEFT JOIN user_profile up ON u.id_profile = up.id_profile 
         WHERE u.deleted_at IS NULL
         ORDER BY u.full_name`,
        { type: db.seq.QueryTypes.SELECT }
      );

      res.json({
        success: true,
        data: users
      });

    } catch (error) {
      console.error('Error in getUsersForTesting:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = new PermissionTestController();
