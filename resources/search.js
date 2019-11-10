; (function () {



    const vscode = acquireVsCodeApi();
    var dataArray = [];
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
                cachePath = message.cachePath;
                drawGraph();
                drawSearchResults();
                break;
            case 'searchResults':
                let data = message.data;
                dataArray[data.index].match = data.match;
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

    // Search query
    $('#input-search').on('keyup', function (e) {
        if (e.keyCode === 13) {
            search();
        }
    });

    $('#btn-search').on('click', function() {
        search();
    });

    function search() {
        let query = $('#input-search').val();
        if (!query || query === "") {
            for (let i in dataArray) {
                dataArray[i].match = null;
            }
            drawGraph();
        } else {
            for (let i in dataArray) {
                dataArray[i].match = false;
            }
            vscode.postMessage({
                command: 'search',
                value: query,
            });
            drawSearchResults();
        }
    }

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

        for (let index in dataArray) {
            let item = dataArray[index];
            let fileContainer = createDom("div", { "style": `display: inline-block; position: relative; width: ${width + 40}px; height: ${canvasHeight + 10}px` });
            let rectangle = createDom("div", { "class": "file", "style": `background-repeat: no-repeat; background-color: #333333; left: ${x}px; width: ${width}px; height: auto; background-size: auto 100%;`, "data-index": index });
            fileContainer.appendChild(rectangle);

            let span = createDom("span", {"class": "matches"});
            span.innerHTML = "0 Match(es)";
            fileContainer.appendChild(span);

            let path = "vscode-resource:" + cachePath + item.hash + ".svg";
            let image = createDom("img", {"src": path})
            rectangle.appendChild(image);

            let text = createDom("p", { "style": `transform: rotate(90deg) translateX(100%); position: absolute; right: 25px; top: -15px; transform-origin: 100% 100%; margin: 0;` });
            text.innerHTML = item.name + " (" + item.relativePath + ") " + item.lines;
            fileContainer.appendChild(text);
            container.appendChild(fileContainer);
        }
    }

    function drawSearchResults() {
        for (let index in dataArray) {
            let item = dataArray[index];
            let rectangle = $(`div.file[data-index=${index}]`);
            rectangle.find('div').remove();
            rectangle.parent().removeClass('no-matches');

            if (item.match === false) {
                // processing
                rectangle.parent().find('span').text('Processing...')
            } else if (item.match === null) {
                // not set yet after init
                rectangle.parent().find('span').text(' ')
            } else if (Object.keys(item.match).length === 0) {
                // no results
                rectangle.parent().find('span').text('No matches')
                rectangle.parent().addClass('no-matches');
            } else {
                // results
                let matches = Object.keys(item.match).length;
                rectangle.parent().find('span').text(matches + (matches === 1 ? ' match' : ' matches'))
                for (let i in item.match) {
                    let match = item.match[i];
                    let line = createDom("div", { style: `position: absolute; top: ${i * 3 + 1}px; height: 2px; width: 100%;`, "data-index": index, "data-line": i, class: "match" });
                    rectangle.append(line);
                }
            }
        }
    }

})()