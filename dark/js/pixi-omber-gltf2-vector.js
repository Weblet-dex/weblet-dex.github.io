this.PIXI = this.PIXI || {};
(function (exports) {
'use strict';

/**
 * Class for holding a Gltf model
 */

class GltfModel extends PIXI.utils.EventEmitter
{
    constructor(json, glbBuffer) 
    {
    	super();
        this.json = json;
        this.glbBuffer = glbBuffer;
        // Calculate the min and max values of positions
        this.min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
        this.max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
        this.walkScenePrimitives((primitive) => {
            if (!('POSITION' in primitive.attributes)) return;
            const positionAccessor = this.json.accessors[primitive.attributes.POSITION];
            for (let n = 0; n < 3; n++)
        	{
                this.min[n] = Math.min(this.min[n], positionAccessor.min[n]);
                this.max[n] = Math.max(this.max[n], positionAccessor.max[n]);
        	}
        });
        // Try to find z-separation values so that we can easily order shapes
        let zSeparation = 0.0;
        if ('asset' in this.json && 'extras' in this.json.asset && typeof(this.json.asset.extras) == 'object')
    	{
        	if ('OMBER_zSeparation' in this.json.asset.extras)
        		this.zSeparation = this.json.asset.extras.OMBER_zSeparation; 
    	}
    }

    destroy()
    {
    	this.dispose();
    	super.destroy();
    }
    
    dispose()
    {
    	this.emit('dispose', this);
    }
    
    walkScenePrimitives(primitiveHandler) 
    {
    	let gltfJson = this.json;
        let sceneNum = 0;
        if ('scene' in gltfJson) sceneNum = gltfJson.scene;
        const scene = gltfJson.scenes[sceneNum];
        scene.nodes.forEach( node => GltfModel.walkNodesPrimitives(gltfJson, gltfJson.nodes[node], primitiveHandler));
    }
    static walkNodesPrimitives(gltfJson, node, primitiveHandler) 
    {
        if ('children' in node) 
        {
            node.children.forEach( node => this.walkNodesPrimitives(gltfJson, gltfJson.nodes[node], primitiveHandler));
        }
        // TODO: Handle transformation matrices
        if ('mesh' in node) 
        {
            this.walkMeshPrimitives(gltfJson.meshes[node.mesh], primitiveHandler);
        }
    }
    static walkMeshPrimitives(mesh, primitiveHandler) 
    {
        if ('primitives' in mesh) 
        {
            mesh.primitives.forEach( primitive => primitiveHandler(primitive) );
        }
    }
    
    static parseGltf(json, buffer) 
    {
        let gltf = new GltfModel(json, buffer);
        return gltf;
    }
}

const VertexProgram = 
`attribute vec3 aVertexPosition;
attribute vec4 aColor;
varying lowp vec4 vColor;
uniform mat4 transformMatrix;
void main(void) {
    gl_Position = transformMatrix * vec4(aVertexPosition, 1.0);
    vColor = aColor;
}`;

const FragmentProgram = 
`varying lowp vec4 vColor;
void main(void) {
	gl_FragColor  = vColor;
}`;

class VectorMeshShader extends PIXI.Shader
{
	constructor(gl) 
    {
		super(gl, VertexProgram, FragmentProgram);
        this.transformMatrix = new PIXI.Matrix();
		this.transformMatrix4x4 = new Float32Array(16);
	}
}

class VectorMeshRenderer extends PIXI.ObjectRenderer
{
	constructor(renderer) 
    {
		super(renderer);
		this.isActive = false;
		
		// Keep track of VAOs set-up for the meshes in a gltf
		this.primitiveVaos = new Map();
		this.gltfVaoSetup = new Set();
		
		this.renderer.on('prerender', this.onPrerender, this);
	}
	onPrerender()
	{
		// Reset the positions of objects in z buffer at the start of
		// rendering
		this.zNext = 1 - this.zBufferSeparation; 
	}
	onContextChange() 
    {
		let gl = this.renderer.gl;
		this.shader = new VectorMeshShader(gl);
	}
	destroy()
	{
		this.renderer.off('prerender', this.onPrerender, this);
		if (this.shader)
		{
			this.shader.destroy();
		}
		this.shader = null;
	}
	start()
	{
		super.start();
		if (!this.isActive) {
			// If the VectorMeshRenderer is the active renderer when finished rendering,
			// then stop() won't be called at the end of the rendering. But start() will
			// still be called at the start of the next rendering, so we have to avoid
			// push new state
			this.renderer.state.push();
			this.renderer.state.setDepthTest(true);
	        // Turn on blending with back-to-front rendering and without pre-multiplied alpha
	        this.renderer.state.setBlend(true);
	        this.renderer.state.setBlendMode(PIXI.BLEND_MODES.NORMAL_NPM);
		}
		this.isActive = true;
	}
	stop()
	{
		super.stop();
		this.renderer.state.pop();
		this.isActive = false;
	}
	render(vectorMesh) 
    {
		const gl = this.renderer.gl;
        const gltf = vectorMesh.gltf;
        this.setupVaos(gl, gltf);
		this.renderer.bindShader(this.shader);
        this.renderVaos(gl, vectorMesh, gltf);
	}
    setupVaos(gl, gltf) 
    {
        if (this.gltfVaoSetup.has(gltf)) return;
        const renderer = this.renderer;
        
        gltf.walkScenePrimitives((primitive) => {
            // Omber GLTF data uses vertex colors (with alpha) and positions
            // and triangle mode
            if (!('COLOR_0' in primitive.attributes)) return;
            if (!('POSITION' in primitive.attributes)) return;
            if (('mode' in primitive) && primitive.mode !== 4) return;
            const colorAccessor = gltf.json.accessors[primitive.attributes.COLOR_0];
            const positionAccessor = gltf.json.accessors[primitive.attributes.POSITION];
            if (colorAccessor.type != 'VEC4') return;
            if (colorAccessor.bufferView !== positionAccessor.bufferView) return;
            if (colorAccessor.count !== positionAccessor.count) return;
            if (positionAccessor.componentType !== 5126) return;
            if (colorAccessor.componentType !== 5126 && colorAccessor.componentType !== 5121) return;
            let indexAccessor = null;
            if ('indices' in primitive)
            {
                indexAccessor = gltf.json.accessors[primitive.indices];
                if (indexAccessor.componentType !== 5123) return;
            }
            
            // Set up array buffers
            const bufferView = gltf.json.bufferViews[colorAccessor.bufferView];
            let buffer = gltf.glbBuffer.buffer;
            // Only do glb right now
            if ('uri' in gltf.json.buffers[bufferView.buffer]) return;
            const arraybuffer = buffer.slice(gltf.glbBuffer.byteOffset + bufferView.byteOffset, gltf.glbBuffer.byteOffset + bufferView.byteOffset + bufferView.byteLength);
            const vertexBuffer = PIXI.glCore.GLBuffer.createVertexBuffer(gl, null, gl.STATIC_DRAW);
            vertexBuffer.upload(arraybuffer, 0, false);
            
            // Set up VAO
            const vao = renderer.createVao();
            vao.addAttribute(vertexBuffer, this.shader.attributes.aVertexPosition, gl.FLOAT, !!positionAccessor.normalized, bufferView.byteStride, positionAccessor.byteOffset);
            if (colorAccessor.componentType === 5126) 
            {
                vao.addAttribute(vertexBuffer, this.shader.attributes.aColor, gl.FLOAT, !!colorAccessor.normalized, bufferView.byteStride, colorAccessor.byteOffset);
            }
            else if (colorAccessor.componentType === 5121) 
            {
                vao.addAttribute(vertexBuffer, this.shader.attributes.aColor, gl.UNSIGNED_BYTE, !!colorAccessor.normalized, bufferView.byteStride, colorAccessor.byteOffset);
            }
            let indexBuffer;
            if (indexAccessor != null)
            {
                // TODO: unwind properly if error
                const idxBufferView = gltf.json.bufferViews[indexAccessor.bufferView];
                let buffer = gltf.glbBuffer.buffer;
                // Only do glb right now
                if ('uri' in gltf.json.buffers[idxBufferView.buffer]) return;
                const idxArrayBuffer = buffer.slice(gltf.glbBuffer.byteOffset + idxBufferView.byteOffset, gltf.glbBuffer.byteOffset + idxBufferView.byteOffset + idxBufferView.byteLength);
                indexBuffer = PIXI.glCore.GLBuffer.createIndexBuffer(gl, idxArrayBuffer, gl.STATIC_DRAW);
                vao.addIndex(indexBuffer);
            }
            
            // Save the VAO
            let vaoCount;
            if (indexAccessor != null)
            	vaoCount = indexAccessor.count;
            else
            	vaoCount = colorAccessor.count;
            this.primitiveVaos.set(primitive, 
            		{
            			vao: vao,
            			vaoCount: vaoCount,
            			vertexBuffer: vertexBuffer,
            			indexBuffer: indexBuffer
            		});
        });
        // Mark that VAOs have been set-up for the gltf 
        this.gltfVaoSetup.add(gltf);
        gltf.on('dispose', this.onDisposeGltfVaos, this);
    }
    renderVaos(gl, vectorMesh, gltf) 
    {
    	let zScale = -1.0;
    	if (gltf.zSeparation)
		{
            zScale = -1.0 / gltf.zSeparation * this.zBufferSeparation;
		}
        let zOffset = -gltf.min[2] * zScale + this.zNext;
        let zSkip = (gltf.max[2] - gltf.min[2]) * zScale - this.zBufferSeparation;

        // Render opaque objects first
    	gltf.walkScenePrimitives((primitive) => {
    		if (!('material' in primitive)) return;
    		const mat = gltf.json.materials[primitive.material];
    		if (!('alphaMode' in mat) || mat.alphaMode == 'OPAQUE')
    			this.renderPrimitive(primitive, vectorMesh, zScale, zOffset);
        });
    	// Then render transparent ones in order
    	gltf.walkScenePrimitives((primitive) => {
    		if ('material' in primitive)
			{
        		const mat = gltf.json.materials[primitive.material];
        		if (!('alphaMode' in mat) || mat.alphaMode == 'OPAQUE')
        			return;
			}
            this.renderPrimitive(primitive, vectorMesh, zScale, zOffset);
        });
    	this.zNext += zSkip;
    }
    renderPrimitive(primitive, vectorMesh, zScale, zOffset)
    {
    	const vao = this.primitiveVaos.get(primitive);
        if (!vao) return;
        // Multiply the MVP matrix in advance instead of in shader
        this.renderer._activeRenderTarget.projectionMatrix.copy(this.shader.transformMatrix).append(vectorMesh.worldTransform);
		let matrix = this.shader.transformMatrix4x4;
		matrix[0] = this.shader.transformMatrix.a;
		matrix[1] = this.shader.transformMatrix.b;
		matrix[2] = 0;
		matrix[3] = 0;
		matrix[4] = -this.shader.transformMatrix.c;
		matrix[5] = -this.shader.transformMatrix.d;
		matrix[6] = 0;
		matrix[7] = 0;
		matrix[8] = 0;
		matrix[9] = 0;
		matrix[10] = zScale;
		matrix[11] = 0;
		matrix[12] = this.shader.transformMatrix.tx;
		matrix[13] = this.shader.transformMatrix.ty;
		matrix[14] = zOffset;
		matrix[15] = 1;
        this.shader.uniforms.transformMatrix = matrix;
        this.renderer.bindVao(vao.vao);
        vao.vao.draw(this.renderer.gl.TRIANGLES, vao.vaoCount, 0);
    }
    
    // When a GltfModel is disposed, we need to clear all the WebGL VAOs associated
    // with it
    onDisposeGltfVaos(gltf)
    {
    	gltf.off('dispose', this.onDisposeGltfVaos, this);

    	// Destroy the VAOs and other GL buffers for each primitive
    	gltf.walkScenePrimitives((primitive) => {
        	const vao = this.primitiveVaos.get(primitive);
        	vao.vao.destroy();
        	vao.vertexBuffer.destroy();
        	if (vao.indexBuffer) vao.indexBuffer.destroy();
            this.primitiveVaos.delete(primitive);
        });
        this.gltfVaoSetup.delete(gltf);
    }
}
VectorMeshRenderer.prototype.shader = null;
VectorMeshRenderer.prototype.zNext = 0.0;
// Rescale things to use as much of the depth buffer as possible
// (assuming a 16-bit linear depth buffer)
VectorMeshRenderer.prototype.zBufferSeparation = 1.0 / 32000;


class VectorMesh extends PIXI.Container 
{
	constructor(gltf) 
    {
		super();
        if (!(gltf instanceof GltfModel)) throw 'Expecting GLTF data loaded from Omber GLTF loader';
        this.gltf = gltf;
	}
	_renderWebGL(renderer)
	{
		renderer.setObjectRenderer(renderer.plugins.omber);
		renderer.plugins.omber.render(this);
	}
	// Omber isn't a good fit for the height/width/hitarea model used by Pixi.js
	// because its glTF meshes have a default anchor point that isn't in the upper-left corner.
	get width() {
		return this.scale.x * (this.gltf.max[0] - this.gltf.min[0]);
	}
	set width(val) {
		this.scale.x = val / (this.gltf.max[0] - this.gltf.min[0]);
	}
	get height() {
		return this.scale.y * (this.gltf.max[1] - this.gltf.min[1]);
	}
	set height(val) {
		this.scale.y = val / (this.gltf.max[1] - this.gltf.min[1]);
	}
	_calculateBounds()
	{
		this._bounds.addPoint(new PIXI.Point(this.gltf.min[0], -this.gltf.max[1]));
		this._bounds.addPoint(new PIXI.Point(this.gltf.max[0], -this.gltf.min[1]));
	}
	containsPoint(pt)
	{
		const localPt = this.worldTransform.applyInverse(pt);
		return localPt.x >= this.gltf.min[0] && localPt.x <= this.gltf.max[0]
				&& localPt.y <= -this.gltf.min[1] && localPt.y >= -this.gltf.max[1];
	}
}


// WebGL only
PIXI.WebGLRenderer.registerPlugin('omber', VectorMeshRenderer);

function loadGlb(resource) 
{
	resource.omberMesh = true;
	let dataView = new DataView(resource.data);
	let magic = dataView.getUint32(0, true);
	if (magic != 0x46546C67) return;  // 'glTF'
	let version = dataView.getUint32(4, true);
	if (version != 2) return;
	let fileLength = dataView.getUint32(8, true);
	let json = null;
	let binBuffer = null;
	for (let offset = 12; offset < fileLength;) 
    {
		let chunkLength = dataView.getUint32(offset, true);
		let chunkType = dataView.getUint32(offset + 4, true);
		if (chunkType == 0x4E4F534A)   // 'JSON'
        {
            json = JSON.parse(new TextDecoder().decode(new Uint8Array(resource.data, offset + 8,  chunkLength)));
		} else if (chunkType == 0x004E4942)   // 'BIN'
        {
			binBuffer = new DataView(resource.data, offset + 8,  chunkLength);
		}
		offset = offset + 8 + chunkLength;
	}
    resource.gltf = GltfModel.parseGltf(json, binBuffer);
}

function omberGlbLoad(resource, next) 
{
    if (resource.data && resource.extension == 'glb')
    {
        loadGlb(resource);
    }
    next();
}


// New loaders will be configured to support loading .glb files.
PIXI.loaders.Resource.setExtensionXhrType('glb', PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER);
PIXI.loaders.Resource.setExtensionLoadType('glb', PIXI.loaders.Resource.LOAD_TYPE.XHR);
PIXI.loaders.Loader.addPixiMiddleware(() => omberGlbLoad);

// The premade shared PIXI loader has already been created though (only new loaders 
// will have .glb support added to it automatically), so .glb support needs to be 
// added to the shared PIXI loader separately.
PIXI.loader.use(omberGlbLoad);

exports.omberGlbLoad = omberGlbLoad;
exports.VectorMesh = VectorMesh;
exports.GltfModel = GltfModel;

}((this.PIXI.omber = this.PIXI.omber || {})));
//# sourceMappingURL=pixi-omber-gltf2-vector.js.map