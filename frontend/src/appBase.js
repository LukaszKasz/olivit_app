const APP_BASE_SEGMENT = '/olivitqms';

export function getAppBasePath(pathname = window.location.pathname) {
    if (pathname === APP_BASE_SEGMENT || pathname.startsWith(`${APP_BASE_SEGMENT}/`)) {
        return APP_BASE_SEGMENT;
    }

    return '/';
}

export function withAppBasePath(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const basePath = getAppBasePath();

    if (basePath === '/') {
        return normalizedPath;
    }

    return `${basePath}${normalizedPath}`;
}
