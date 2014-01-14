var DEFAULT_THEME = 'monokai';
var DEFAULT_SHADER = 'Normal';
var SCENE_SIZE = 1024;
var SHADERS = {
  'Normal': [],
  'Film': [{
    shader: THREE.FilmShader
  }],
  'Kaleido': [{
    shader: THREE.KaleidoShader,
    uniforms: {
      sides: 12,
      angle: 0
    }
  }],
  'RGB Shift': [{
    shader: THREE.RGBShiftShader,
    uniforms: {
      amount: 0.03
    }
  }],
  'Sepia': [{
    shader: THREE.SepiaShader,
    uniforms: {
      amount: 1
    }
  }],
  'Tilt Shift': [{
    shader: THREE.HorizontalTiltShiftShader,
    uniforms: {
      h: 3 / SCENE_SIZE,
      r: 0.5
    }
  }, {
    shader: THREE.VerticalTiltShiftShader,
    uniforms: {
      v: 3 / SCENE_SIZE,
      r: 0.5
    }
  }],
  'Vignette': [{
    shader: THREE.VignetteShader,
    uniforms: {
      darkness: 1,
      offset: 1.6
    }
  }],
};


var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, 1, 10, SCENE_SIZE);

var renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  alpha: true,
  canvas: document.querySelector('canvas'),
});
renderer.setSize(SCENE_SIZE / devicePixelRatio, SCENE_SIZE / devicePixelRatio);

var composer = new THREE.EffectComposer(renderer);

var controls = new THREE.EditorControls(camera, renderer.domElement);

var view = document.querySelector('.view');

var activeShader = false;

function applySelectedShader(event) {
  var passes = SHADERS[event.target.value];

  activeShader = false;

  composer = new THREE.EffectComposer(renderer);
  composer.setSize(SCENE_SIZE * 2, SCENE_SIZE * 2);
  composer.addPass(new THREE.RenderPass(scene, camera));

  for (var i = 0; i < passes.length; i++) {
    var pass = passes[i];
    var effect = new THREE.ShaderPass(pass.shader);
    for (var uniform in pass.uniforms) {
      effect.uniforms[uniform].value = pass.uniforms[uniform];
    }
    composer.addPass(effect);
  }
  if (effect) {
    effect.renderToScreen = true;
    activeShader = true;
  }
}

var objects = [];

var font = {
  size: 4,
  height: 0,
  curveSegments: 4,
  font: "cousine",
}

var sample = new THREE.TextGeometry('█', font);
sample.computeBoundingBox();
var textWidth = sample.boundingBox.max.x - sample.boundingBox.min.x;
var textHeight = sample.boundingBox.max.y - sample.boundingBox.min.y;

var largestLineWidth = 0;
var lastMarginLeft = 0;
var marginTop = 0;

function computeTextBounds(text, color, isNewLine) {
  if (isNewLine) {
      marginTop += textHeight;
      largestLineWidth = Math.max(lastMarginLeft, largestLineWidth);
      lastMarginLeft = 0;
  }
  if (text.trim().length === 0) {
    lastMarginLeft += text.length * textWidth;
    return false;
  }
  var textGeom = new THREE.TextGeometry(text, font);
  var material = new THREE.MeshBasicMaterial({ color: color });
  var textMesh = new THREE.Mesh(textGeom, material);
  textMesh.position.set(lastMarginLeft, -marginTop, 0);
  lastMarginLeft += text.length * textWidth;

  return textMesh;
}

var drawCodeTimeoutID = null;

function drawCode(showTransition) {
  if (showTransition) {
    view.classList.add('hidden');
  }
  clearTimeout(drawCodeTimeoutID);
  setTimeout(function() {
    var noTimeout = (drawCodeTimeoutID === null ||
                     editor.options.theme !== themeSelector.value ||
                     editor.options.mode !== modeSelector.value)
    drawCodeTimeoutID = setTimeout(function () {
      editor.setOption('mode', modeSelector.value);
      editor.setOption('theme', themeSelector.value);
      var bgColor = window.getComputedStyle(document.querySelector('.CodeMirror')).backgroundColor;
      var foregroundColor = window.getComputedStyle(document.querySelector('.CodeMirror')).color;
      renderer.setClearColor(bgColor);
      document.body.style.backgroundColor = bgColor;

      largestLineWidth = 0;
      lastMarginLeft = 0;
      marginTop = 0;
      objects = [];
      // Deallocate old scene objects.
      while (scene.children.length > 0) {
        scene.children[0].geometry.dispose();
        scene.children[0].material.dispose();
        scene.remove(scene.children[0]);
      }

      var lines = document.querySelectorAll('.CodeMirror-code pre');
      for (var i = 0; i < lines.length; i++) {
        for (var j = 0; j < lines[i].childNodes.length; j++) {
          var node = lines[i].childNodes[j];
          if (node.nodeName === '#text') {
            var text = node.nodeValue;
            var color = foregroundColor;
          } else {
            var text = node.innerText;
            var color = window.getComputedStyle(node).color;
          }
          var textMesh = computeTextBounds(text, color, (j === 0));
          if (textMesh)
            objects.push(textMesh);
        }
      }
      for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
        object.position.x = object.position.x - largestLineWidth / 2;
        object.position.y = object.position.y + lines.length / 2 * textHeight;
        scene.add(object);
      }
      view.classList.remove('hidden');
    }, noTimeout ? 0 : 500);
  }, (drawCodeTimeoutID === null) ? 0 : 200); // Must be kept in sync with CSS Transition.
}

var render = function () {
  requestAnimationFrame(render);
  if (activeShader)
    composer.render();
  else
    renderer.render(scene, camera);
};


function initCamera() {
  camera.position.x = 70;
  camera.position.y = 30;
  camera.position.z = 130;
  camera.lookAt(new THREE.Vector3(0, 0, 0));
}


var themeSelector = document.querySelector('#themeSelector');

function initThemeSelector() {
  // Retrieve CSS files in the `theme` codemirror folder to populate themes
  // and add their stylesheet to the DOM.
  chrome.runtime.getPackageDirectoryEntry(function (fs) {
    fs.getDirectory('lib/codemirror/theme', {}, function (themeDirectory) {
      var reader = themeDirectory.createReader();
      reader.readEntries(function (themeFiles) {
        themeFiles.sort(function (a, b) {
            if (a.name > b.name) return 1;
            if (a.name < b.name) return -1;
            return 0;
        });
        for (var i = 0; i < themeFiles.length; i++) {
          var fileName = themeFiles[i].name;
          var themeName = fileName.replace('.css', '');
          var prettyName = themeName.replace(/-/g, ' ');
          themeSelector.appendChild(new Option(prettyName, themeName));

          var stylesheet = document.createElement('link');
          stylesheet.rel = 'stylesheet';
          stylesheet.href = '/lib/codemirror/theme/' + fileName;
          document.head.appendChild(stylesheet);
        }
      });
    });
  });
  themeSelector.addEventListener('change', drawCode);
}

var modeSelector = document.querySelector('#modeSelector');

function initModeSelector() {
  for (mode in CodeMirror.modes) {
    modeSelector.appendChild(new Option(mode, mode));
  }
  modeSelector.addEventListener('change', drawCode);
}

var shaderSelector = document.querySelector('#shaderSelector');

function initShaderSelector() {
  for (var shader in SHADERS) {
    shaderSelector.appendChild(new Option(shader, shader));
  }
  shaderSelector.addEventListener('change', applySelectedShader);
}

function initEditor() {

  function onBackgroundFileRead(event) {
    var textarea = document.querySelector('#textarea');
    textarea.value = event.target.result;
    themeSelector.value = DEFAULT_THEME;
    modeSelector.value = 'javascript';
    shaderSelector.value = DEFAULT_SHADER;
    editor = CodeMirror.fromTextArea(textarea);
    editor.setOption('extraKeys', {
      "Ctrl-S": saveCode
    });
    editor.setOption('mode', modeSelector.value);
    editor.setOption('theme', themeSelector.value);
    editor.on('change', drawCode);
    drawCode(false);
    initCamera();
  }

  // Retrieve content from background file and display it.
  chrome.runtime.getPackageDirectoryEntry(function (fs) {
    fs.getFile('background.js', {}, function (backgroundFileEntry) {
      backgroundFileEntry.file(function (backgroundFile) {
        var reader = new FileReader();
        reader.onload = onBackgroundFileRead;
        reader.readAsText(backgroundFile);
      })
    });
  });
}

var editor = null;

initThemeSelector();
initModeSelector();
initShaderSelector();
initEditor();

render();
