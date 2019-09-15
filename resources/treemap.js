const vscode = acquireVsCodeApi();
const previousState = vscode.getState();
var dataArray;
var ranges;
var colors;

// Range slider
function initSlider() {
    var slider = document.getElementById('slider');

    noUiSlider.create(slider, {
        range: {
            'min': 0,
            'max': 14
        },
        step: 0.1,
        start: ranges.slice(0, -1), // 20, 40, 60, 80
        connect: [true, true, true, true, true],
        format: {
            to: function (value) {
                return value;
            },
            from: function (value) {
                return value;
            }
        },
        pips: {
            mode: 'count',
            values: 15,
            density: 4
            // mode: 'range',
            // values: [0].concat(ranges), // 0, 20, 40, 60, 80, 100
            // values: [0, 2, 4, 6, 8, 10 , 12, 14], // 0, 20, 40, 60, 80, 100
            // density: 3,
            // stepped: true
        }
    });
    
    slider.noUiSlider.on('change', function(values, handle) {
        ranges[handle] = values[handle];
        drawVisualization();
    });
}

$('document').ready(function() {
    vscode.postMessage({
        command: 'init'
    })
})

// Communication with server
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'init':
            dataArray = message.data;
            ranges = message.ranges;
            colors = message.colors;
            console.log("got init message")
            console.log(message);
            initSlider();
            break;
        case 'updateData':
            let data = message.data;

            for (let i in data) {
                let item = data[i];
                dataArray[item.index][3] = item.riskLevel;
            }

            drawVisualization();
            break;
    }
});

// Init google treemap
google.charts.load('current', {packages:['treemap'], callback: drawVisualization});

function drawVisualization() {
    var data = google.visualization.arrayToDataTable(dataArray);
    var view = new google.visualization.DataView(data);
    view.setColumns([0, 1, 2]);

    console.log("Draw graph");
    console.log(dataArray);

    var container = document.getElementById('chart_div');
    var treemap = new google.visualization.TreeMap(container);

    var observer = new MutationObserver(addColors);
    observer.observe(container, {
        childList: true,
        subtree: true
    });

    function addColors() {
        Array.prototype.forEach.call(container.getElementsByTagName('rect'), function(rect) {
            var textElements = rect.parentNode.getElementsByTagName('text');
            if (textElements.length > 0) {

                var index;
                if (textElements[0].hasAttribute('data-index')) {
                    index = parseInt(textElements[0].getAttribute('data-index'));
                } else {
                    let text = textElements[0].textContent;
                    index = parseInt(text);
                    textElements[0].setAttribute('data-index', index);
                }

                let item = dataArray[index];
                textElements[0].textContent = item[0].v;

                let risk = item[3];
                var color = calculateColor(risk);
                rect.setAttribute('fill', color);
            } 
        });
    }

    function calculateColor(risk) {
        if (risk === -2)
            return 'LIGHTGREY';
        
        if (risk === -1) 
            return 'LIGHTYELLOW'

        var index = 0;
        for (var i = 0; i < ranges.length; i++) {
            if (risk <= ranges[i]) {
                index = i;
                break;
            }
        }
        return colors[index];
    }

    google.visualization.events.addListener(treemap, 'select', showFile);
    google.visualization.events.trigger(treemap, 'select', null);

    var previousSelect = 0;

    function showFile() {
        // TODO: check if has children, if not: open it...
        var selection = treemap.getSelection();

        if (selection && selection.length > 0 && previousSelect === 1) {
            let index = selection[0].row + 1;
            let item = dataArray[index];

            let details = item[0];

            if (details.isFile) {
                // Open file
                vscode.postMessage({
                    command: 'openFile',
                    path: details.path 
                })
            }
        }

        let svgSubItems = $('body').find('svg').find('g').length;
        previousSelect = svgSubItems;
        console.log(svgSubItems);

    }

    treemap.draw(view, {
        showScale: false,
        headerHeight: 25,
        fontColor: 'black',
        generateTooltip: showStaticTooltip
    });

    function showStaticTooltip(row, size, value) {
        let riskLevel = data.getValue(row, 3);
        var riskFormatted = "calculating...";
        if (riskLevel && riskLevel === -2) {
            riskFormatted = "Not supported";
        } else if (riskLevel && riskLevel >= 0) {
            riskFormatted = riskLevel.toFixed(2);
        }
        console.log("Show statistics");
        console.log(data.getValue(row, 0));
        console.log(dataArray[row+1]);
        return '<div style="background:white; color: black; padding:10px; border-style:solid">'+
            '<b>' + dataArray[row + 1][0].v + '</b><br>'+
            'Entropy-level: ' + riskFormatted + '<br> Lines: ' + size +
            (dataArray[row+1][0].isFile === true ? `<br><a data-path="${dataArray[row+1][0].path}">open</a>` : '') +
            '</div>';
    }
}

$('body').on('click', 'a', function() {
    console.log("A clicked: " + $(this).attr('data-path'));
    vscode.postMessage({
        command: 'openFile',
        path: $(this).attr('data-path')
    })
})


window.onresize = function(event) {
    drawVisualization();
};

document.getElementById("type-select").onchange = function(e) {
    let value = e.target.value;
    vscode.postMessage({
        command: 'typeChanged',
        value: value,
    })
};