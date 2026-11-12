import { buildUrl } from './url-helpers';
import { getIconPath } from './getIcon-helper'
import { getSHA256 } from './encrypt';
import { validatePassword } from './password-validator';
import { version as appVersion } from '../../../package.json';
import { transformedDate } from './transformedData';

export const utils = {
    buildUrl,
    getIconPath,
    getSHA256,
    validatePassword,
    appVersion,
}


export { transformedDate };
//TODO: CATEGORIZAR POR SERVICIOS, FORMULARIOS, ETC