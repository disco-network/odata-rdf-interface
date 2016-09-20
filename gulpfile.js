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
    "src/**/**.ts",
    "spec/**.ts",
    "typings/**.d.ts",
    "!build/**"
  ])
    .pipe(tslint({}))
    .pipe(tslint.report("verbose"));
});

var sourceMapsConfig = {
  includeContent: false,
  sourceRoot: function (file) {
    // needed to fix relative path in sourceMaps
    // HACK: this solution is coupled with the current folder structure!!
    var path = "../".repeat((file.relative.match(/\//g) || []).length + 1) + "../src/";
    return path;
  }
};

var tsProject = tsc.createProject("tsconfig.json");

function build(sourcePath, targetPath) {
  var tsResult = gulp.src(sourcePath)
    .pipe(sourcemaps.init())
    .pipe(tsc(tsProject));

  return merge([
    tsResult.dts
      .pipe(gulp.dest("build/lib")),
    tsResult.js
      .pipe(sourcemaps.write("../maps", sourceMapsConfig))
      .pipe(gulp.dest("build/" + targetPath))
  ]);
}

gulp.task("build-spec", function () {
  return build(["spec/**/*.ts", "src/**/*.ts", "typings/*.ts"], "tests");
});
gulp.task("build-lib", function () {
  return build(["src/**/*.ts", "typings/*.ts"], "lib");
});

gulp.task("build-package.json", function () {
  var appPackageJson = JSON.parse(fs.readFileSync(__dirname + "/package.json", "utf8"));
  var npmPackageJson = {
    "name": appPackageJson.name,
    "description": appPackageJson.description,
    "version": appPackageJson.version,
    "author": appPackageJson.author,
    "repository": appPackageJson.repository,
    "main": "lib/index.js",      // TODO: generate this from app package.json
    "typings": "typings/index.d.ts", // TODO: generate this from app package.json
    "dependencies": appPackageJson.dependencies,
    "keywords": appPackageJson.keywords,
    "license": appPackageJson.license,
    "bugs": appPackageJson.bugs
  }
  fs.mkdirSync(path.join(__dirname, "build"));
  fs.writeFileSync(path.join(__dirname, "build", "package.json"), JSON.stringify(npmPackageJson, null, 2));
});

function copyStaticSrc() {
  return gulp.src([
    "./src/**/**/odata4-mod.abnf"
  ]);
}
gulp.task("copy-static-lib", ["copy-license"], function () {
  return copyStaticSrc().pipe(gulp.dest("build/lib"));
});
gulp.task("copy-static-spec", function () {
  return copyStaticSrc().pipe(gulp.dest("build/tests/src"));
});
gulp.task("copy-license", function () {
  return gulp.src([
    "README.md",
    "LICENSE"
  ]).pipe(gulp.dest("build"));
});

gulp.task("build", function (cb) {
  return runSequence(
    "clean-all",
    ["build-lib", "copy-static-lib", "build-package.json"],
    cb
  );
});

// TODO: depricated - will be removed soon!
gulp.task("clean-all-old", function () {
  return del(["./maps", "./lib"]);
});
gulp.task("clean-all", ["clean-all-old"], function () {
  return del(["./build"]);
});

gulp.task("build-tests", function (cb) {
  return runSequence(
    "clean-all",
    ["build-spec", "copy-static-spec"],
    cb
  );
});

gulp.task("tests", ["build-tests"], function () {
  return gulp.src("./build/tests/spec/*.js")
    .pipe(mocha());
});

//alternative name for the "tests" task
gulp.task("specs", ["tests"]);
