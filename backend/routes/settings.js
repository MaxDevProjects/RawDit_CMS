import { Router } from 'express';
import { readSiteConfig, writeSiteConfig } from '../lib/sites.js';
import { updateAdminCredentials } from '../lib/auth.js';

const APPEARANCE_MODES = ['light', 'dark', 'contrast'];

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const config = await readSiteConfig(req.siteId);
    const safeConfig = {
      ...config,
      admin: {
        username: config.admin?.username || ''
      },
      appearance: {
        useSystem: typeof config.appearance?.useSystem === 'boolean' ? config.appearance.useSystem : true,
        mode: APPEARANCE_MODES.includes(config.appearance?.mode) ? config.appearance.mode : 'light'
      }
    };
    res.json(safeConfig);
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const payload = req.body || {};
    if (payload.admin) {
      await updateAdminCredentials(req.siteId, payload.admin);
    }
    const config = await readSiteConfig(req.siteId);
    if (payload.deployment) {
      config.deployment = {
        ...config.deployment,
        ...payload.deployment
      };
    }
    if (payload.preview) {
      config.preview = {
        ...config.preview,
        ...payload.preview
      };
    }
    if (payload.appearance) {
      const incoming = payload.appearance;
      const nextMode = APPEARANCE_MODES.includes(incoming.mode) ? incoming.mode : config.appearance?.mode || 'light';
      config.appearance = {
        useSystem:
          typeof incoming.useSystem === 'boolean'
            ? incoming.useSystem
            : typeof config.appearance?.useSystem === 'boolean'
            ? config.appearance.useSystem
            : true,
        mode: nextMode
      };
    } else if (!config.appearance) {
      config.appearance = {
        useSystem: true,
        mode: 'light'
      };
    }
    if (typeof payload.autoDeploy === 'boolean') {
      config.autoDeploy = payload.autoDeploy;
    }
    await writeSiteConfig(req.siteId, config);
    res.json({
      message: 'Settings updated',
      config: {
        ...config,
        admin: {
          username: config.admin?.username || ''
        },
        appearance: {
          useSystem: config.appearance?.useSystem ?? true,
          mode: APPEARANCE_MODES.includes(config.appearance?.mode) ? config.appearance.mode : 'light'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
