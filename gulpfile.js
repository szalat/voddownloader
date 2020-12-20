var gulp = require('gulp'),
    order = require("gulp-order"),
    concat = require('gulp-concat'),
    replace = require('gulp-replace'),
    gulpif = require('gulp-if'),
    rename = require("gulp-rename"),
    header = require('gulp-header'),
    clean = require('gulp-clean'),
    server = require( 'gulp-develop-server'),
    livereload = require('gulp-livereload'),
    log = require('fancy-log'),
    colors = require('colors/safe'),
    pkg = require('./package');
    fs = require('fs');

var config = {
    tmp_dir: 'tmp',
    dist_dir: 'dist',
    css_dir: 'src/css',
    src_dir: 'src',
    source_dir: 'src/source',
    static_dir: 'src/static',
    util_dir: 'src/util',
    script_name: pkg.config.scriptName,
    css_name: pkg.config.cssName,
    server: {
        options: {
            path: './app/server.js'
        },
        files: [
            './app/server.js',
            pkg.config.cssName,
            pkg.config.scriptName
        ],
        port: pkg.config.serverPort
    },
    production: true
};

const UNIT_SEP = String.fromCharCode(31);

function padEnd(target, minLen = 15, padStr = ' ') {
    if (typeof padEnd.cache !== 'object') padEnd.cache = {};

    padStr = typeof padStr !== 'string' || padStr.length < 1 ? ' ' : padStr;
    let padKey = target.length + UNIT_SEP + minLen + UNIT_SEP + padStr;

    // read from cache
    if (padKey in padEnd.cache) return target + padEnd.cache[padKey];

    let finalPad = '';
    let padLen = minLen - target.length;
    for (let i = 0; i < padLen; i++)
        finalPad += padStr;

    // make cache
    padEnd.cache[padKey] = finalPad;

    return target + finalPad;
}

function extraHeaders() {
    var headerData = pkg.config.headers;
    let ret = [];
    for (let field of Object.keys(headerData)) {
        if (Array.isArray(headerData[field])) {
            headerData[field].forEach(element => {
                if (typeof element === 'string') {
                    ret.push(`// @${padEnd(field)}${element}`);
                }
            })
        } else if (typeof headerData[field] === 'string') {
            ret.push(`// @${padEnd(field)}${headerData[field]}`);
        }
    }
    return ret.join('\n')
}

function detectDevelopmentFlag(cb){
    if (process.argv.indexOf('--development') > -1) {
        config.production = false;
    }
    cb();
}

function cleanTmpFiles() {
    return gulp.src(config.tmp_dir + "/*", {read: false}).pipe(clean());
}

function utilPartAttach() {
    return gulp.src(config.util_dir + '/*.js')
        .pipe(order([
            'const.js', 'tool.js', 'domTamper.js', 'videoGrabber.js',
            'configurator.js', 'changeVideoDetector.js', 'wrapperDetector.js'
        ]))
        .pipe(concat('utils.js'))
        .pipe(gulp.dest(config.tmp_dir));
}

function sourcePartAttach() {
    return gulp.src(config.source_dir + '/*.js')
        .pipe(order([
            'tvp_vod.js', 'tvp_cyf.js', 'tvp_reg.js', 'tvp.js', 'tvn.js',
            'ipla.js', 'vod.js', 'vod_ipla.js', 'wp.js', 'cda.js'
        ]))
        .pipe(concat('sources.js'))
        .pipe(gulp.dest(config.tmp_dir));
}

function runPartAttach() {
    return gulp.src(config.src_dir + '/*.js')
        .pipe(order([
            'starter.js', 'attach.js'
        ]))
        .pipe(concat('execute.js'))
        .pipe(gulp.dest(config.tmp_dir));
}

function joinScriptParts() {
    return gulp.src(config.tmp_dir + '/*.js')
        .pipe(order([
            'utils.js', 'sources.js', 'execute.js'
        ]))
        .pipe(concat('content.js'))
        .pipe(gulp.dest(config.tmp_dir));
}

function joinCssFiles(){
    return gulp.src(config.css_dir + '/*.css')
        .pipe(order([
            'download.css', "buttons.css", "sources.css"
        ]))
        .pipe(concat(config.css_name))
        .pipe(gulp.dest(config.dist_dir));
}

//remove some expressions before release
function replaceRegularExpressions() {
    var regularExpressions = [
        //remove whole lines with 'debugger'
        {pattern: /(?:.*debugger.*\n)/g, replacement: '', counter: 0},
        //remove whole lines with console.log(...)
        {pattern: /(?:.*console\.log\(.*\).*\n)/g, replacement: '', counter: 0}
    ];

    var task = gulp.src(config.tmp_dir + '/content.js');
    regularExpressions.forEach(function(element){
        task = task.pipe(
            gulpif(config.production, replace(element.pattern, function(match) {
                element.counter++;
                return element.replacement;
            }))
        );
    });

    return task.pipe(gulp.dest(config.tmp_dir)).on('end', function() {
        regularExpressions.forEach(function(element){
            log.info('Found: ' + colors.red(element.counter) + ' matches of pattern: ' + colors.blue(element.pattern));
        });
    });
}

function replaceContent(){
    return gulp.src(config.tmp_dir + '/content.js')
        .pipe(replace(/(?:\n)/g, '\n\t')) //linux eol
        .pipe(replace(/(?:\r\n)/g, '\r\n\t')) //windows eol
        .pipe(gulp.dest(config.tmp_dir));
}

function prepareHeaders(){
    var headers = {};
    var cssDevFile = pkg.config.development.resourcesHost + ':' + config.server.port +
        '/' + config.dist_dir + '/' + config.css_name;
    var cssProdFile = pkg.config.production.resourcesHost + '/' + config.dist_dir + '/' + config.css_name;

    headers.name = config.production ? pkg.config.production.name : pkg.name;
    headers.version = config.production ? pkg.version : pkg.version + '-develop';
    headers.cssPath = config.production ? cssProdFile : cssDevFile;

    return headers;
}

function fillTemplate() {
    var contentFile = fs.readFileSync(config.tmp_dir + '/content.js', 'utf8');
    var headerFile = fs.readFileSync(config.static_dir + '/header.txt', 'utf8');
    return gulp.src(config.static_dir + '/template.js')
        .pipe(replace(/\/\/ @include@/, contentFile)) //fill template with script content
        .pipe(rename(config.script_name))
        .pipe(header(headerFile, { data : prepareHeaders() } )) //add header
        .pipe(replace(/\/\/ @include@/, extraHeaders())) //fill extra headers from config file
        .pipe(gulp.dest(config.dist_dir))
}

function startServer(cb){
    server.listen(config.server.options, livereload.listen );
    function restart(file) {
        server.changed( function( error ) {
            if( ! error ) livereload.changed( file.path );
        });
    }
    gulp.watch(config.server.files).on( 'change', restart );
    cb();
}

exports.clean = cleanTmpFiles;
exports.clean.description = "clean temporary files";
exports.server = startServer;
exports.server.description = "run development server";
exports.default = gulp.series(
    detectDevelopmentFlag,
    cleanTmpFiles,
    gulp.parallel(utilPartAttach, sourcePartAttach, runPartAttach),
    joinScriptParts,
    gulp.parallel(joinCssFiles,
        gulp.series(replaceContent, replaceRegularExpressions, fillTemplate))
);
exports.default.description = "build project";
exports.default.flags = {
    '--development': "add some development features to script"
};