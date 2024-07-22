## 3D Frogger

<div>
Use the arrow keys / buttons to take the frog back home!
</div>

<style>
    .webGLContainer {
        display: flex;
        justify-content: center;
    }
    .controls {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
    }
    .button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        margin: 0 1rem;
        background: var(--gray);
        font-weight: bold;
        font-size: 1rem;
        cursor: pointer;
        user-select: none;
    }
    #score, #status {
        user-select: none;
    }
    #status {
        height: 1.1rem;
    }
    @media (max-width: 767px) {
        #webGLCanvas {
            max-width: 300px;
        }
    }
</style>

<script type="text/javascript" src="./gl-matrix.js"></script>
<script type="text/javascript" src="./rasterize.js"></script>
<script type="text/javascript">
    window.onload = function() {
        main();
    };
    function triggerKeydown(key) {
        var event = new KeyboardEvent('keydown', { code: key });
        document.dispatchEvent(event);
    }
</script>

<div id="score">Score: <b class="green">0</b></div>
<div id="status"></div>
<div class="webGLContainer">
    <canvas id="webGLCanvas" width="500" height="500"></canvas>
</div>
<div class="controls">
    <div class="button" id="up" onclick="triggerKeydown('ArrowUp')">↑</div>
    <div class="button" id="down" onclick="triggerKeydown('ArrowDown')">↓</div>
    <div class="button" id="left" onclick="triggerKeydown('ArrowLeft')">←</div>
    <div class="button" id="right" onclick="triggerKeydown('ArrowRight')">→</div>
</div>
