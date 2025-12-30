let treeData = [];
let draggedInfo = null;

window.onload = () => {
    const mode = localStorage.getItem('mode') || 'dark';
    const scheme = localStorage.getItem('scheme') || 'default';
    
    if(mode === 'light') { 
        document.body.classList.add('light-mode'); 
        document.getElementById('modeToggle').checked = false; 
    }
    
    changeScheme(scheme);
    document.getElementById('schemeSelect').value = scheme;
    
    const saved = localStorage.getItem('json_builder_v7');
    if (saved) treeData = JSON.parse(saved);
    render();
};

function toggleDarkMode() {
    const isDark = document.getElementById('modeToggle').checked;
    document.body.classList.toggle('light-mode', !isDark);
    localStorage.setItem('mode', isDark ? 'dark' : 'light');
}

function changeScheme(val) {
    document.body.classList.remove('scheme-pastel', 'scheme-highcontrast', 'scheme-outline');
    if(val !== 'default') document.body.classList.add('scheme-' + val);
    localStorage.setItem('scheme', val);
}

function onDragStart(ev, type, isNew, nodeId = null) {
    draggedInfo = { type, isNew, nodeId };
    ev.dataTransfer.setData("text", type);
}

function allowDrop(ev) { ev.preventDefault(); }

function onDrop(ev, targetId) {
    ev.preventDefault(); ev.stopPropagation();
    let movingNode;
    if (draggedInfo.isNew) {
        movingNode = {
            id: 'id_' + Math.random().toString(36).substr(2, 9),
            type: draggedInfo.type,
            key: targetId === 'root' ? "key_" + treeData.length : "key",
            value: draggedInfo.type === 'number' ? 0 : draggedInfo.type === 'boolean' ? true : "...",
            children: [],
            collapsed: false
        };
    } else {
        movingNode = findAndRemove(treeData, draggedInfo.nodeId);
    }
    if (!movingNode) return;
    if (targetId === 'root') {
        treeData.push(movingNode);
    } else {
        const parent = findById(treeData, targetId);
        if (parent && (parent.type === 'object' || parent.type === 'array')) {
            movingNode.key = (parent.type === 'array') ? null : (movingNode.key || "key");
            parent.children.push(movingNode);
        }
    }
    render(); save();
}

function toggleCollapse(id) {
    const node = findById(treeData, id);
    if(node) {
        node.collapsed = !node.collapsed;
        render();
        save();
    }
}

function findById(nodes, id) {
    for (let n of nodes) {
        if (n.id === id) return n;
        const found = findById(n.children || [], id);
        if (found) return found;
    }
    return null;
}

function findAndRemove(nodes, id) {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) return nodes.splice(i, 1)[0];
        const found = findAndRemove(nodes[i].children || [], id);
        if (found) return found;
    }
    return null;
}

function render() {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '';
    treeData.forEach(node => canvas.appendChild(createNodeUI(node)));
    document.getElementById('preview').innerText = JSON.stringify(buildJSON(treeData), null, 2);
}

function createNodeUI(node) {
    const div = document.createElement('div');
    div.className = 'node' + (node.collapsed ? ' collapsed' : '');
    div.setAttribute('data-id', node.id);

    const header = document.createElement('div');
    header.className = 'node-header';
    header.draggable = true;
    header.ondragstart = (e) => onDragStart(e, node.type, false, node.id);

    if (node.type === 'object' || node.type === 'array') {
        const toggle = document.createElement('span');
        toggle.className = 'toggle-btn';
        toggle.innerText = node.collapsed ? '▶' : '▼';
        toggle.onclick = (e) => { 
            e.preventDefault();
            e.stopPropagation();
            toggleCollapse(node.id); 
        };
        header.appendChild(toggle);
    }

    if (node.key !== null) {
        const ki = document.createElement('input');
        ki.className = 'key-input';
        ki.value = node.key;
        ki.onchange = (e) => { node.key = e.target.value; render(); save(); };
        header.appendChild(ki);
        header.innerHTML += ' : ';
    }

    if (['string', 'number', 'boolean'].includes(node.type)) {
        const valInput = document.createElement(node.type === 'boolean' ? 'select' : 'input');
        if(node.type === 'boolean') {
            valInput.innerHTML = `<option value="true" ${node.value?'selected':''}>true</option><option value="false" ${!node.value?'selected':''}>false</option>`;
            valInput.onchange = (e) => { node.value = e.target.value === 'true'; render(); save(); };
        } else {
            valInput.type = node.type === 'number' ? 'number' : 'text';
            valInput.value = node.value;
            valInput.onchange = (e) => { node.value = node.type === 'number' ? Number(e.target.value) : e.target.value; render(); save(); };
        }
        header.appendChild(valInput);
    }

    const trash = document.createElement('span');
    trash.className = 'trash'; trash.innerHTML = '✕';
    trash.onclick = () => { findAndRemove(treeData, node.id); render(); save(); };
    header.appendChild(trash);
    div.appendChild(header);

    if (node.type === 'object' || node.type === 'array') {
        const dz = document.createElement('div');
        dz.className = 'drop-zone';
        dz.ondragover = allowDrop;
        dz.ondragenter = (e) => dz.classList.add('drop-over');
        dz.ondragleave = (e) => dz.classList.remove('drop-over');
        dz.ondrop = (e) => onDrop(e, node.id);
        node.children.forEach(c => dz.appendChild(createNodeUI(c)));
        div.appendChild(dz);
    }
    return div;
}

function buildJSON(nodes, isArr = false) {
    let res = isArr ? [] : {};
    nodes.forEach(n => {
        let v = (n.type === 'object' || n.type === 'array') ? buildJSON(n.children, n.type === 'array') : n.value;
        if(isArr) res.push(v); else res[n.key] = v;
    });
    return res;
}

function save() { localStorage.setItem('json_builder_v7', JSON.stringify(treeData)); }
function clearAll() { if(confirm("Wirklich alles löschen?")) { treeData = []; render(); save(); } }

function handleImport(ev) {
    const reader = new FileReader();
    reader.onload = (e) => {
        treeData = mapToNodes(JSON.parse(e.target.result));
        render(); save();
    };
    reader.readAsText(ev.target.files[0]);
}

function mapToNodes(obj) {
    return Object.keys(obj).map(k => {
        const v = obj[k];
        let type = Array.isArray(v) ? 'array' : typeof v;
        const n = { id:'id_'+Math.random(), type, key: isNaN(k)&&!Array.isArray(obj)?k:null, value: (type!=='object'&&type!=='array')?v:'', children:[], collapsed: false };
        if(type==='object'||type==='array') n.children = mapToNodes(v);
        return n;
    });
}

function downloadJSON() {
    const blob = new Blob([JSON.stringify(buildJSON(treeData), null, 2)], {type: "application/json"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = "data.json"; a.click();
}
