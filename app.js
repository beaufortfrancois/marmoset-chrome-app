var DEFAULT_THEME = 'monokai';
var DEFAULT_SHADER = 'Normal';
var SCENE_SIZE = 1024;
var SHADERS = {
  'Normal': [],
  'Vignette': [{
    shader: THREE.VignetteShader,
    uniforms: {
      darkness: 1,
      offset: 1.6
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
  }]
};


var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, 1, 10, SCENE_SIZE);

var renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  alpha: true,
});
renderer.setSize(SCENE_SIZE / devicePixelRatio, SCENE_SIZE / devicePixelRatio);

var composer = new THREE.EffectComposer(renderer);

var controls = new THREE.EditorControls(camera, renderer.domElement);

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
var sample = new THREE.TextGeometry('_', font);
sample.computeBoundingBox();
underscoreWidth = sample.boundingBox.max.x - sample.boundingBox.min.x;

var lastTextGeom = null;
var marginLeft = null;
var marginTop = 0;
var x = 0;
var lastMarginLeft = 0;
var offsetX = underscoreWidth / 2 / 2;
var offsetY = 2;
var lastTextX = 0;
var largestLineWidth = 0;

function reset() {
  largestLineWidth = 0;
  lastTextX = 0;
  lastTextGeom = null;
  marginLeft = null;
  marginTop = 0;
  x = 0;
  lastMarginLeft = 0;
  while (scene.children.length > 0) {
    scene.children[0].geometry.dispose();
    scene.children[0].material.dispose();
    scene.remove(scene.children[0]);
  }
  objects = [];
}

function howManyRightSpaces(text) {
  var numSpaces = 0;
  var index = text.length - 1;
  while (text[index] === ' ') {
    numSpaces++;
    index--;
  }
  return numSpaces;
}

function addText(text, color, isNewLine) {
  if (text.trim().length === 0) {
    if (isNewLine) {
      largestLineWidth = Math.max(lastMarginLeft, largestLineWidth);
      marginTop += font.size + offsetY;
      lastMarginLeft = 0;
    }
    lastMarginLeft += text.length * underscoreWidth;
    return;
  }

  var material = new THREE.MeshBasicMaterial({
    color: color
  });
  var textGeom = new THREE.TextGeometry(text, font);
  var textMesh = new THREE.Mesh(textGeom, material);
  textGeom.computeBoundingBox();

  if (isNewLine) {
    largestLineWidth = Math.max(lastMarginLeft, largestLineWidth);
    marginTop += font.size + offsetY;
    lastMarginLeft = 0;
  }
  lastTextX = textGeom.boundingBox.max.x;

  textMesh.position.set(lastMarginLeft, -marginTop, 0);
  objects.push(textMesh);

  lastMarginLeft += howManyRightSpaces(text) * underscoreWidth + lastTextX + offsetX;
}

var render = function () {
  requestAnimationFrame(render);
  if (activeShader)
    composer.render();
  else
    renderer.render(scene, camera);
};


var drawCodeTimeoutID = null;

function drawCode() {
  renderer.domElement.classList.add('hidden');
  clearTimeout(drawCodeTimeoutID);
  setTimeout(function() {
    var drawCodeTimeout = 500;
    if (drawCodeTimeout === null ||
      myCodeMirror.options.theme !== themeSelector.value ||
      myCodeMirror.options.mode !== modeSelector.value) {
        drawCodeTimeout = 0;
    }
    drawCodeTimeoutID = setTimeout(function () {
      myCodeMirror.setOption('mode', modeSelector.value);
      myCodeMirror.setOption('theme', themeSelector.value);
      var bgColor = window.getComputedStyle(document.querySelector('.CodeMirror')).backgroundColor;
      var foregroundColor = window.getComputedStyle(document.querySelector('.CodeMirror')).color;
      renderer.setClearColor(bgColor);
      document.body.style.backgroundColor = bgColor;

      reset();
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
          addText(text, color, (j === 0));
        }
      }
      for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
        object.position.x = object.position.x - largestLineWidth / 2;
        object.position.y = object.position.y + lines.length / 2 * (font.size + offsetY);
        scene.add(object);
      }
      renderer.domElement.classList.remove('hidden');
    }, drawCodeTimeout);
  }, 200); // Must be kept in sync with CSS Transition.
}

function dataURItoBlob(dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  return new Blob([ab], {
    "type": mimeString
  });
};

function exportCode() {
  var config = {
    type: 'saveFile',
    suggestedName: 'marmoset-' + Date.now() + '.png'
  };
  chrome.fileSystem.chooseEntry(config, function (writableEntry) {
    var blob = dataURItoBlob(renderer.domElement.toDataURL('png'));
    writableEntry.createWriter(function (writer) {
      writer.write(blob);
    });
  });
}
document.querySelector('#exportButton').addEventListener('click', exportCode);


var themeSelector = document.querySelector('#themeSelector');

function initThemeSelector() {
  // Retrieve CSS files in the `theme` codemirror folder to populate themes
  // and add their stylesheet to the DOM.
  chrome.runtime.getPackageDirectoryEntry(function (fs) {
    fs.getDirectory('lib/codemirror/theme', {}, function (themeDirectory) {
      var reader = themeDirectory.createReader();
      reader.readEntries(function (themeFiles) {
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

function initCamera() {
  camera.position.x = 70;
  camera.position.y = 30;
  camera.position.z = 130;
  camera.lookAt(new THREE.Vector3(0, 0, 0));
}

function initEditor() {

  function onBackgroundFileRead(event) {
    var textarea = document.querySelector('#textarea');
    textarea.value = event.target.result;
    themeSelector.value = DEFAULT_THEME;
    modeSelector.value = 'javascript';
    shaderSelector.value = DEFAULT_SHADER;
    myCodeMirror = CodeMirror.fromTextArea(textarea);
    myCodeMirror.setOption('extraKeys', {
      "Ctrl-S": exportCode
    });
    myCodeMirror.on('change', drawCode);
    drawCode();
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

var myCodeMirror = null;

initThemeSelector();
initModeSelector();
initShaderSelector();
initEditor();

document.body.appendChild(renderer.domElement);
render();
