(function() {
    "use strict";

    var root = this,
        Chart = root.Chart,
        helpers = Chart.helpers;

    var DatasetScale = Chart.Element.extend({
        // overridden in the chart. Will set min and max as properties of the scale for later use. Min will always be 0 when using a dataset and max will be the number of items in the dataset
        calculateRange: helpers.noop,
        isHorizontal: function() {
            return this.options.position == "top" || this.options.position == "bottom";
        },
        getPixelForValue: function(value, index, includeOffset) {
            // This must be called after fit has been run so that 
            //      this.left, this.top, this.right, and this.bottom have been defined
            if (this.isHorizontal()) {
                var isRotated = (this.labelRotation > 0);
                var innerWidth = this.width - (this.paddingLeft + this.paddingRight);
                var valueWidth = innerWidth / Math.max((this.max - ((this.options.gridLines.offsetGridLines) ? 0 : 1)), 1);
                var valueOffset = (valueWidth * index) + this.paddingLeft;

                if (this.options.gridLines.offsetGridLines && includeOffset) {
                    valueOffset += (valueWidth / 2);
                }

                return this.left + Math.round(valueOffset);
            } else {
                return this.top + (index * (this.height / this.max));
            }
        },
        calculateLabelRotation: function(maxHeight, margins) {
            //Get the width of each grid by calculating the difference
            //between x offsets between 0 and 1.
            var labelFont = helpers.fontString(this.options.labels.fontSize, this.options.labels.fontStyle, this.options.labels.fontFamily);
            this.ctx.font = labelFont;

            var firstWidth = this.ctx.measureText(this.labels[0]).width;
            var lastWidth = this.ctx.measureText(this.labels[this.labels.length - 1]).width;
            var firstRotated;
            var lastRotated;

            this.paddingRight = lastWidth / 2 + 3;
            this.paddingLeft = firstWidth / 2 + 3;

            this.labelRotation = 0;

            if (this.options.display) {
                var originalLabelWidth = helpers.longestText(this.ctx, labelFont, this.labels);
                var cosRotation;
                var sinRotation;
                var firstRotatedWidth;

                this.labelWidth = originalLabelWidth;

                //Allow 3 pixels x2 padding either side for label readability
                // only the index matters for a dataset scale, but we want a consistent interface between scales
                var gridWidth = Math.floor(this.getPixelForValue(0, 1) - this.getPixelForValue(0, 0)) - 6;

                //Max label rotate should be 90 - also act as a loop counter
                while ((this.labelWidth > gridWidth && this.labelRotation === 0) || (this.labelWidth > gridWidth && this.labelRotation <= 90 && this.labelRotation > 0)) {
                    cosRotation = Math.cos(helpers.toRadians(this.labelRotation));
                    sinRotation = Math.sin(helpers.toRadians(this.labelRotation));

                    firstRotated = cosRotation * firstWidth;
                    lastRotated = cosRotation * lastWidth;

                    // We're right aligning the text now.
                    if (firstRotated + this.options.labels.fontSize / 2 > this.yLabelWidth) {
                        this.paddingLeft = firstRotated + this.options.labels.fontSize / 2;
                    }

                    this.paddingRight = this.options.labels.fontSize / 2;

                    if (sinRotation * originalLabelWidth > maxHeight) {
                        // go back one step
                        this.labelRotation--;
                        break;
                    }

                    this.labelRotation++;
                    this.labelWidth = cosRotation * originalLabelWidth;

                }
            } else {
                this.labelWidth = 0;
                this.paddingRight = 0;
                this.paddingLeft = 0;
            }

            if (margins) {
                this.paddingLeft -= margins.left;
                this.paddingRight -= margins.right;

                this.paddingLeft = Math.max(this.paddingLeft, 0);
                this.paddingRight = Math.max(this.paddingRight, 0);
            }

        },
        // Fit this axis to the given size
        // @param {number} maxWidth : the max width the axis can be
        // @param {number} maxHeight: the max height the axis can be
        // @return {object} minSize : the minimum size needed to draw the axis
        fit: function(maxWidth, maxHeight, margins) {
            this.calculateRange();
            this.calculateLabelRotation(maxHeight, margins);

            var minSize = {
                width: 0,
                height: 0,
            };

            var labelFont = helpers.fontString(this.options.labels.fontSize, this.options.labels.fontStyle, this.options.labels.fontFamily);
            var longestLabelWidth = helpers.longestText(this.ctx, labelFont, this.labels);

            if (this.isHorizontal()) {
                minSize.width = maxWidth;
                this.width = maxWidth;

                var labelHeight = (Math.cos(helpers.toRadians(this.labelRotation)) * longestLabelWidth) + 1.5 * this.options.labels.fontSize;
                minSize.height = Math.min(labelHeight, maxHeight);
            } else {
                minSize.height = maxHeight;
                this.height = maxHeight;

                minSize.width = Math.min(longestLabelWidth + 6, maxWidth);
            }

            this.width = minSize.width;
            this.height = minSize.height;
            return minSize;
        },
        // Actualy draw the scale on the canvas
        // @param {rectangle} chartArea : the area of the chart to draw full grid lines on
        draw: function(chartArea) {
            if (this.options.display) {

                var setContextLineSettings;

                // Make sure we draw text in the correct color
                this.ctx.fillStyle = this.options.labels.fontColor;

                if (this.isHorizontal()) {
                    setContextLineSettings = true;
                    var yTickStart = this.options.position == "bottom" ? this.top : this.bottom - 10;
                    var yTickEnd = this.options.position == "bottom" ? this.top + 10 : this.bottom;
                    var isRotated = this.labelRotation !== 0;

                    helpers.each(this.labels, function(label, index) {
                        var xLineValue = this.getPixelForValue(label, index, false); // xvalues for grid lines
                        var xLabelValue = this.getPixelForValue(label, index, true); // x values for labels (need to consider offsetLabel option)

                        if (this.options.gridLines.show) {
                            if (index === 0) {
                                // Draw the first index specially
                                this.ctx.lineWidth = this.options.gridLines.zeroLineWidth;
                                this.ctx.strokeStyle = this.options.gridLines.zeroLineColor;
                                setContextLineSettings = true; // reset next time
                            } else if (setContextLineSettings) {
                                this.ctx.lineWidth = this.options.gridLines.lineWidth;
                                this.ctx.strokeStyle = this.options.gridLines.color;
                                setContextLineSettings = false;
                            }

                            xLineValue += helpers.aliasPixel(this.ctx.lineWidth);

                            // Draw the label area
                            this.ctx.beginPath();

                            if (this.options.gridLines.drawTicks) {
                                this.ctx.moveTo(xLineValue, yTickStart);
                                this.ctx.lineTo(xLineValue, yTickEnd);
                            }

                            // Draw the chart area
                            if (this.options.gridLines.drawOnChartArea) {
                                this.ctx.moveTo(xLineValue, chartArea.top);
                                this.ctx.lineTo(xLineValue, chartArea.bottom);
                            }

                            // Need to stroke in the loop because we are potentially changing line widths & colours
                            this.ctx.stroke();
                        }

                        if (this.options.labels.show) {
                            this.ctx.save();
                            this.ctx.translate(xLabelValue, (isRotated) ? this.top + 12 : this.top + 8);
                            this.ctx.rotate(helpers.toRadians(this.labelRotation) * -1);
                            this.ctx.font = this.font;
                            this.ctx.textAlign = (isRotated) ? "right" : "center";
                            this.ctx.textBaseline = (isRotated) ? "middle" : "top";
                            this.ctx.fillText(label, 0, 0);
                            this.ctx.restore();
                        }
                    }, this);
                } else {
                    // Vertical
                    if (this.options.gridLines.show) {}

                    if (this.options.labels.show) {
                        // Draw the labels
                    }
                }
            }
        }
    });
    Chart.scales.registerScaleType("dataset", DatasetScale);



}).call(this);