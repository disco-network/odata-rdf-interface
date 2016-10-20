"use strict";
var fs = require("fs");
var path = require("path");
var gulp = require("gulp"),
  runSequence = require("run-sequence"),
  del = require("del"),
  mocha = require("gulp-mocha"),
  tslint = require("gulp-tslint"),
  tsc = require("gulp-typescript"),
  sourcemaps = require("gulp-sourcemaps"),
  merge = require("merge2");

gulp.task("lint", function () {
  return gulp.src([
    "**",
    "!**/*.d.ts",
    "!**/typings/**"
  ])
    .pipe(tslint({}))
    .pipe(tslint.report("verbose"));
});

var sourceMapsConfig = {
  includeContent: false,
  mapSources: function (sourcePath) {
    return '../' + sourcePath;
  }
};

var tsProject = tsc.createProject("tsconfig.json");

function build(sourcePath, base, targetPath) {
  var tsResult = gulp.src(sourcePath, { base: base })
    .pipe(sourcemaps.init())
    .pipe(tsProject(tsc.reporter.longReporter()));

  return merge([
    tsResult.dts
      .pipe(gulp.dest("build/typings/" + targetPath)),
    tsResult.js
      .pipe(sourcemaps.write((/* HACK! Better place all files side by side? */(targetPath === "") ? "" : "../") + "maps/" + targetPath, sourceMapsConfig))
      .pipe(gulp.dest("build/" + targetPath))
  ]);
}

gulp.task("build-spec", function () {
  return build(["src/**/*.ts", "typings/**.d.ts", "!./node_modules/**"], "./src", "");
});
gulp.task("build-lib", function () {
  return build(["src/lib/**/*.ts", "typings/**.d.ts", "!./node_modules/**"], "./src", "lib");
});

gulp.task("build-package.json", function () {
  var appPackageJson = JSON.parse(fs.readFileSync(__dirname + "/package.json", "utf8"));
  var npmPackageJson = {
    "name": appPackageJson.name,
    "description": appPackageJson.description,
    "version": appPackageJson.version,
    "author": appPackageJson.author,
    "repository": appPackageJson.repository,
    "main": "index.js",      // TODO: generate this from app package.json
    "typings": "index.d.ts", // TODO: generate this from app package.json
    "dependencies": appPackageJson.dependencies,
    "keywords": appPackageJson.keywords,
    "license": appPackageJson.license,
    "bugs": appPackageJson.bugs
  }
  // Is this necessary in any case? fs.mkdirSync(path.join(__dirname, "build"));
  fs.mkdirSync(path.join(__dirname, "build"));
  fs.mkdirSync(path.join(__dirname, "build", "lib"));
  fs.writeFileSync(path.join(__dirname, "build", "lib", "package.json"), JSON.stringify(npmPackageJson, null, 2));
});

function copyStaticSrc() {
  return gulp.src([
    "./src/lib/**/odata4-mod.abnf"
  ]);
}
gulp.task("copy-static-lib", ["copy-license"], function () {
  return copyStaticSrc().pipe(gulp.dest("build/lib"));
});
gulp.task("copy-static-spec", function () {
  return copyStaticSrc().pipe(gulp.dest("build/spec"));
});
gulp.task("copy-license", function () {
  return gulp.src([
    "README.md",
    "LICENSE"
  ]).pipe(gulp.dest("build/lib"));
});

// TODO: depricated - will be removed soon!
gulp.task("clean-all-old", function () {
  return del(["./maps", "./lib"]);
});
gulp.task("clean-all", ["clean-all-old"], function () {
  return del(["./build"]);
});

gulp.task("build", function (cb) {
  return runSequence(
    "clean-all",
    ["build-lib", "copy-static-lib", "build-package.json"],
    cb
  );
});

/*gulp.task("build-tests", function (cb) {
  return runSequence(
    "build-spec", 
    ["copy-static-spec"],
    cb
  );
});*/

gulp.task("build-all", ["build"], function (cb) {
  return runSequence(
    "build-spec",
    ["copy-static-spec"],
    cb
  );
});

gulp.task("run-tests", function () {
  return gulp.src("build/spec/*.js")
    .pipe(mocha());
});

gulp.task("tests", ["build-all"], function (cb) {
  return runSequence(
    "run-tests",
    cb
  );
});

//alternative name for the "tests" task
gulp.task("specs", ["tests"]);