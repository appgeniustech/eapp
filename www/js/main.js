require.config({
    baseUrl: 'js',
    waitSeconds: 3600,
    paths: {
        'index': 'index',
        'jquery': 'jquery-2.1.1.min',
        'panzoom': 'panzoom',
        'ChUI': 'chui-3.8.2',
        'app': 'app/app'
    },
    shim: {
        'jquery': {
            exports: '$'
        },
        'ChUI': {
            deps: ['jquery'],
            exports: '$'
        },
        'app': {
            deps: ['ChUI', 'index', 'panzoom'],
            exports: 'app'
        },
        underscore: {
            exports: '_'
        }
    }
});
require(['app'], function (app) {
    app.init();
});