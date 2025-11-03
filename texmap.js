class Renderer {
	constructor(canvas) {
		this.canvas = canvas;
		this.gl = null;
		this.program = null;
		this.locations = {};
		this.objects = []; // store multiple objects
	}

	async initialize() {
		/** @type {WebGL2RenderingContext} */
		this.gl = this.canvas.getContext("webgl2");
		if (!this.gl) throw new Error("WebGL2 not supported");
		this.gl.enable(this.gl.DEPTH_TEST);
		this.gl.disable(this.gl.CULL_FACE);

		const vsSource = document.getElementById("vertex-shader").text.trim();
		const fsSource = document.getElementById("fragment-shader").text.trim();

		const vertexShader = this._createShader(this.gl.VERTEX_SHADER, vsSource);
		const fragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, fsSource);
		this.program = this._createProgram(vertexShader, fragmentShader);

		this.locations.position = this.gl.getAttribLocation(this.program, "a_position");
		this.locations.color = this.gl.getUniformLocation(this.program, "u_color");
		this.locations.matrix = this.gl.getUniformLocation(this.program, "u_matrix");
	}

	addObject(positions, color) {
		const gl = this.gl;
		const vao = gl.createVertexArray();
		gl.bindVertexArray(vao);

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

		gl.enableVertexAttribArray(this.locations.position);
		gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 0, 0);

		this.objects.push({
			vao,
			vertexCount: positions.length / 3,
			color
		});

		gl.bindVertexArray(null);
	}

	clear() {
		const gl = this.gl;
		this._resizeCanvas();
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.clearColor(0.1, 0.1, 0.1, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}

	draw(matrix) {
		const gl = this.gl;
		gl.useProgram(this.program);

		for (const obj of this.objects) {
			gl.bindVertexArray(obj.vao);
			gl.uniformMatrix4fv(this.locations.matrix, false, matrix);
			gl.uniform4fv(this.locations.color, obj.color);
			gl.drawArrays(gl.TRIANGLES, 0, obj.vertexCount);
		}
	}

	_resizeCanvas() {
		const c = this.canvas;
		if (c.width !== c.clientWidth || c.height !== c.clientHeight) {
			c.width = c.clientWidth;
			c.height = c.clientHeight;
		}
	}

	_createShader(type, source) {
		const gl = this.gl;
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error(gl.getShaderInfoLog(shader));
		}
		return shader;
	}

	_createProgram(vs, fs) {
		const gl = this.gl;
		const program = gl.createProgram();
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program));
		}
		return program;
	}
}

// -------------- Matrix utilities ----------------
function toRadians(deg) { return (deg * Math.PI) / 180; }

function perspective(fovy, aspect, near, far) {
	const f = 1.0 / Math.tan(toRadians(fovy) / 2);
	const nf = 1 / (near - far);
	return new Float32Array([
		f / aspect, 0, 0, 0,
		0, f, 0, 0,
		0, 0, (far + near) * nf, -1,
		0, 0, (2 * far * near) * nf, 0
	]);
}

function translate(x, y, z) {
	return new Float32Array([
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		x, y, z, 1
	]);
}

function rotateX(angle) {
	const a = toRadians(angle), c = Math.cos(a), s = Math.sin(a);
	return new Float32Array([
		1, 0, 0, 0,
		0, c, s, 0,
		0, -s, c, 0,
		0, 0, 0, 1
	]);
}

function rotateY(angle) {
	const a = toRadians(angle), c = Math.cos(a), s = Math.sin(a);
	return new Float32Array([
		c, 0, -s, 0,
		0, 1, 0, 0,
		s, 0, c, 0,
		0, 0, 0, 1
	]);
}

function mult(a, b) {
	const out = new Float32Array(16);
	for (let i = 0; i < 4; ++i) {
		for (let j = 0; j < 4; ++j) {
			out[j * 4 + i] =
				a[0 * 4 + i] * b[j * 4 + 0] +
				a[1 * 4 + i] * b[j * 4 + 1] +
				a[2 * 4 + i] * b[j * 4 + 2] +
				a[3 * 4 + i] * b[j * 4 + 3];
		}
	}
	return out;
}

// -------------- Geometry ----------------
function makeWallFace(a, b, c, d) {
	return [...a, ...b, ...c, ...a, ...c, ...d];
}

function makeRoom(size) {
	const s = size / 2;
	return [
		makeWallFace([s, -s, -s], [-s, -s, -s], [-s, s, -s], [s, s, -s]),
		makeWallFace([-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s]),
		makeWallFace([s, -s, s], [s, -s, -s], [s, s, -s], [s, s, s]),
		makeWallFace([-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s])
	];
}

// ------------- Main ----------------
let renderer;
let angle = 0;

window.onload = async () => {
	renderer = new Renderer(document.getElementById("canvas"));
	await renderer.initialize();

	const cubeFaces = makeRoom(2.0);
	cubeFaces.push(makeRoom(2.1));
	const colors = [
		[0.2, 1.0, 0.2, 1.0], // Back
		[1.0, 1.0, 0.2, 1.0], // Bottom
		[1.0, 0.5, 0.2, 1.0], // Right
		[1.0, 0.2, 1.0, 1.0]  // Left
	];
	colors.push([
		[1, 0, 0, 1], // Red
		[1.0, 1.0, 0.2, 1.0], // Bottom
		[1.0, 0.5, 0.2, 1.0], // Right
		[1.0, 0.2, 1.0, 1.0]  // Left
	])



	// add each face to renderer
	for (let i = 0; i < cubeFaces.length; i++) {
		renderer.addObject(cubeFaces[i], colors[i]);
	}

	render();
};

function render() {
	const gl = renderer.gl;
	renderer.clear();


	angle += 0.5; // Rotate the cube
	const projection = perspective(45, gl.canvas.width / gl.canvas.height, 0.1, 100);
	const view = translate(0, 0, -4);
	const rotationY = rotateY(angle);
	const rotationX = rotateX(angle * 0.7);
	const model = mult(rotationY, rotationX);
	const mvp = mult(projection, mult(view, model));

	renderer.draw(mvp);
	requestAnimationFrame(render);
}
