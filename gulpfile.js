const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const closure = require('google-closure-compiler-js').gulp();

const $ = gulpLoadPlugins();

function license() {
  return $.license('Apache', {
    organization: 'Copyright (c) 2016 Google Ince. All rights reserved.',
    tiny: true
  });
}

function uglifyJS() {
  return $.uglify({preserveComments: 'some'});
}

gulp.task('vulcanize', function() {
  return gulp.src([
    'deps.html'
  ])
  .pipe($.vulcanize({
    stripComments: true,
    inlineScripts: true,
    inlineCss: true
  }))
  .pipe($.rename({suffix: '.vulcanized'}))
  .pipe($.crisper({scriptInHead: true})) // Separate HTML and JS. CSP friendly.
  // .pipe($.if('*.html', minifyHtml())) // Minify HTML output.
  // .pipe($.if('*.html', cssslam.gulp())) // Minify CSS in HTML output.
  .pipe($.if('*.js', uglifyJS())) // Minify JS in HTML output.
  // .pipe($.if('*.js', license())) // Add license to top.
  .pipe(gulp.dest('./'));
});

gulp.task('script', function() {
  return gulp.src([
    './js/app.js'
  ])
  .pipe(closure({
      compilationLevel: 'SIMPLE',
      warningLevel: 'DEFAULT',
      languageIn: 'ECMASCRIPT6_STRICT',
      languageOut: 'ECMASCRIPT5',
      jsOutputFile: 'app.min.js',
      createSourceMap: true
    }))
  .pipe(license()) // Add license to top.
  .pipe(gulp.dest('./js'));
});

gulp.task('default', ['script', 'vulcanize'], function() {

});
