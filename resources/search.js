; (function () {
    const vscode = acquireVsCodeApi();
    const loading = document.getElementById('loading');
    var dataArray = [];
    var minimapCache = {};
    var cachePath = "";

    window.onload = function (evnet) {
        vscode.postMessage({
            command: 'init'
        });
    }

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'init':
                dataArray = message.data;
                minimapCache = message.cache;
                cachePath = message.cachePath;
                drawGraph();
            //    setMinimap(0);
                break;
            case 'searchResults':
                let data = message.data;
                loading.style.display = 'none';

                for (let i in data) {
                    let item = data[i];
                    dataArray[item.index].match = item.match;
                }
                drawSearchResults();
                break;
        }

    });

    $('#container').on('click', '.file:not(.match)', function (e) {
        if (!$(e.target).hasClass('match')) {
            let index = $(this).attr('data-index');
            openFile(index);
        }
    });

    $('#container').on('click', '.match', function (e) {
        let index = $(this).attr('data-index');
        let line = $(this).attr('data-line');
        openFile(index, line);
    });

    $('#input-search').on('change input', function() {
        loading.style.display = 'inline-block';
        let regex = document.getElementById('regex').checked;
        vscode.postMessage({
            command: 'search',
            value: $(this).val(),
            regex: regex,
        })
    })

    function openFile(index, line) {
        if (index >= 0) {
            vscode.postMessage({
                command: 'openFile',
                path: dataArray[index].path,
                line: line,
            })
        }
    }

    function createDom(e, a) {
        n = document.createElement(e);
        for (var p in a)
            n.setAttribute(p, a[p]);
        return n;
    }

    function drawGraph() {
        let container = document.getElementById('container');
        container.innerHTML = '';

        var maxHeight = 0;
        for (let index in dataArray) {
            let item = dataArray[index];
            maxHeight = Math.max(maxHeight, item.lines);
        }

        // calculate size of graph
        let canvasHeight = maxHeight * 2 + 20;

        var x = 5;
        var width = 75;
        var y = 0;

        for (let index in dataArray) {
            let item = dataArray[index];
            let fileContainer = createDom("div", { "style": `display: inline-block; position: relative; width: ${width + 40}px; height: ${canvasHeight + 10}px` });
            let rectangle = createDom("div", { "class": "file", "style": `background-repeat: no-repeat; background-color: #333333; position: absolute; left: ${x}px; top: ${y}px; width: ${width}px; height: ${item.lines * 2}px; background-size: auto 100%;`, "data-index": index });
            fileContainer.appendChild(rectangle);

            let path = "vscode-resource:" + cachePath + item.hash + ".png";
            let image = createDom("img", {"src": path})
            rectangle.appendChild(image);

            let text = createDom("p", { "style": `transform: rotate(90deg) translateX(100%); position: absolute; right: 25px; top: -15px; transform-origin: 100% 100%; margin: 0;` });
            text.innerHTML = item.name + " (" + item.relativePath + ") " + item.lines;
            fileContainer.appendChild(text);

            if (item.match) {
                var hasMatch = false;
                for (let i in item.match) {
                    let match = item.match[i];
                    if (match > 75) {
                        let line = getNode('rect', { x: x, y: y + 2 * i, width: width, height: 2, fill: '#0f0', "data-index": index, "data-line": i });
                        hasMatch = true;
                    }
                }
                if (!hasMatch) {
                }
            }
            container.appendChild(fileContainer);
        }
    }

    function drawSearchResults() {
        for (let index in dataArray) {
            let item = dataArray[index];
            let rectangle = $(`div.file[data-index=${index}]`);
            rectangle.find('div').remove();
            rectangle.parent().removeClass('no-matches');

            if (item.match) {
                var hasMatch = false;
                for (let i in item.match) {
                    let match = item.match[i];
                    if (match > 75) {
                        let line = createDom("div", { style: `position: absolute; top: ${i * 2}px; height: 2px; width: 100%;`, "data-index": index, "data-line": i, class: "match" });
                        rectangle.append(line);
                        hasMatch = true;
                    }
                }
                if (!hasMatch) {
                    rectangle.parent().addClass('no-matches');
                }
            }
        }
    }

    function setMinimap(index) {
        let base = "vscode-resource:" + cachePath;
        if (index >= dataArray.length) {
            $('#node').hide();
            $('#progress').val(0);
            return
        }

        $('#progress').val(index / dataArray.length * 100);

        let item = dataArray[index];
        let hash = item.hash;

        console.log("search " + hash + ".png");
        let cachedItem = minimapCache[hash+".png"]
        if (cachedItem && cachedItem.lastModified >= item.lastModified) {
            var img = new Image();
            console.log("ok, read from cache");
            img.src = base + hash + ".png";
            $(`div[data-index=${index}]`).append(img);
            console.log("IMAGE SET FROM CACHE: ")
            console.log(item);
            setMinimap(++index);
            return;
        } else {
            console.log("update image: " + item.path)
            console.log("reason not exists: " + (cachedItem == undefined))
          //  console.log("reason outdated: " + (cachedItem.lastModified < item.lastModified))
        }

        let node = $('#node')[0];
        node.innerHTML = '';
        
        let content = item.content;
        node.innerHTML = escapeHTML(content);
        domtoimage.toPng(node, { quality: 0.8 })
            .then(function (dataUrl) {
                var img = new Image();
                img.src = dataUrl;
                $(`div[data-index=${index}]`).append(img);
                minimapCache[hash+".png"] = {lastModified: new Date(), path: cachePath + hash+".png", name: hash+".png"}
                vscode.postMessage({
                    command: 'cacheImage',
                    hash: hash,
                    img: dataUrl
                });

                setMinimap(++index);
            })
            .catch(function (error) {
                console.error('oops, something went wrong!', error);
                setMinimap(++index);
            });
    }

    function escapeHTML(html) {
        var fn = function (tag) {
            var charsToReplace = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&#34;'
            };
            return charsToReplace[tag] || tag;
        }
        return html.replace(/[&<>"]/g, fn);
    }

})()