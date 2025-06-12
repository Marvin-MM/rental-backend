
import prisma from '../config/database.js';
import logger from '../config/logger.js';

// Default feature flags
const DEFAULT_FLAGS = {
  PAYMENT_PROCESSING: true,
  REAL_TIME_NOTIFICATIONS: true,
  ANALYTICS_DASHBOARD: true,
  MOBILE_PUSH_NOTIFICATIONS: false,
  ADVANCED_REPORTING: false,
  MAINTENANCE_SCHEDULING: false,
  AUTOMATED_RENT_COLLECTION: false,
  TENANT_PORTAL: true,
  DOCUMENT_MANAGEMENT: false,
  VIRTUAL_TOURS: false,
};

class FeatureFlagService {
  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
    this.lastUpdated = null;
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  async loadFlags() {
    try {
      const now = Date.now();
      if (this.lastUpdated && (now - this.lastUpdated) < this.cacheTTL) {
        return this.flags;
      }

      const dbFlags = await prisma.featureFlag.findMany({
        where: {
          isActive: true,
        },
      });

      // Update flags from database
      const updatedFlags = { ...DEFAULT_FLAGS };
      dbFlags.forEach(flag => {
        updatedFlags[flag.name] = flag.enabled;
      });

      this.flags = updatedFlags;
      this.lastUpdated = now;

      logger.debug('Feature flags loaded from database');
      return this.flags;
    } catch (error) {
      logger.error('Error loading feature flags:', error);
      return this.flags; // Return cached or default flags
    }
  }

  async isEnabled(flagName, userId = null, userRole = null) {
    try {
      await this.loadFlags();

      // Check if flag exists
      if (!(flagName in this.flags)) {
        logger.warn(`Feature flag '${flagName}' not found, defaulting to false`);
        return false;
      }

      // Get base flag value
      let isEnabled = this.flags[flagName];

      // Check for user-specific or role-specific overrides
      if (userId || userRole) {
        const override = await prisma.featureFlagOverride.findFirst({
          where: {
            flagName,
            OR: [
              { userId },
              { userRole },
            ],
            isActive: true,
          },
          orderBy: [
            { userId: 'desc' }, // User-specific takes precedence
            { createdAt: 'desc' },
          ],
        });

        if (override) {
          isEnabled = override.enabled;
        }
      }

      return isEnabled;
    } catch (error) {
      logger.error(`Error checking feature flag '${flagName}':`, error);
      return false; // Fail closed
    }
  }

  async updateFlag(flagName, enabled, updatedBy) {
    try {
      await prisma.featureFlag.upsert({
        where: { name: flagName },
        create: {
          name: flagName,
          enabled,
          createdBy: updatedBy,
        },
        update: {
          enabled,
          updatedBy,
          updatedAt: new Date(),
        },
      });

      // Clear cache to force reload
      this.lastUpdated = null;

      logger.info(`Feature flag '${flagName}' updated to ${enabled} by user ${updatedBy}`);
      return true;
    } catch (error) {
      logger.error(`Error updating feature flag '${flagName}':`, error);
      return false;
    }
  }

  async setUserOverride(flagName, userId, enabled, updatedBy) {
    try {
      await prisma.featureFlagOverride.upsert({
        where: {
          flagName_userId: {
            flagName,
            userId,
          },
        },
        create: {
          flagName,
          userId,
          enabled,
          createdBy: updatedBy,
        },
        update: {
          enabled,
          updatedBy,
          updatedAt: new Date(),
        },
      });

      logger.info(`Feature flag override '${flagName}' set to ${enabled} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error setting user override for '${flagName}':`, error);
      return false;
    }
  }

  async setRoleOverride(flagName, userRole, enabled, updatedBy) {
    try {
      await prisma.featureFlagOverride.upsert({
        where: {
          flagName_userRole: {
            flagName,
            userRole,
          },
        },
        create: {
          flagName,
          userRole,
          enabled,
          createdBy: updatedBy,
        },
        update: {
          enabled,
          updatedBy,
          updatedAt: new Date(),
        },
      });

      logger.info(`Feature flag override '${flagName}' set to ${enabled} for role ${userRole}`);
      return true;
    } catch (error) {
      logger.error(`Error setting role override for '${flagName}':`, error);
      return false;
    }
  }

  async getAllFlags() {
    await this.loadFlags();
    return this.flags;
  }

  // Middleware to check feature flags
  requireFeature(flagName) {
    return async (req, res, next) => {
      try {
        const isEnabled = await this.isEnabled(
          flagName,
          req.user?.id,
          req.user?.role
        );

        if (!isEnabled) {
          return res.status(403).json({
            error: 'Feature not available',
            message: `The feature '${flagName}' is not enabled for your account`,
          });
        }

        next();
      } catch (error) {
        logger.error(`Error checking feature flag in middleware:`, error);
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to check feature availability',
        });
      }
    };
  }
}

export default new FeatureFlagService();
