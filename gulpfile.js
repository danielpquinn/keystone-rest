var gulp = require('gulp'),
  jsdoc = require('gulp-jsdoc');

gulp.task('jsdoc', function () {
  gulp.src('./index.js')
    .pipe(jsdoc.parser())
    .pipe(jsdoc.generator('./documentation/', {
      path: 'ink-docstrap',
      theme: 'flatly'
    }));
});