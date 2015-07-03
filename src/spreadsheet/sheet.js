(function(f, define){
    define([ "../kendo.core", "./runtime", "./references" ], f);
})(function(){

(function(kendo) {
    var RangeRef = kendo.spreadsheet.RangeRef;
    var CellRef = kendo.spreadsheet.CellRef;
    var Range = kendo.spreadsheet.Range;

    var Sheet = kendo.Observable.extend({
        init: function(rowCount, columnCount, rowHeight, columnWidth, headerHeight, headerWidth) {
            kendo.Observable.prototype.init.call(this);

            var cellCount = rowCount * columnCount - 1;

            this._values = new kendo.spreadsheet.SparseRangeList(0, cellCount, null);
            this._types = new kendo.spreadsheet.SparseRangeList(0, cellCount, null);
            this._formulas = new kendo.spreadsheet.SparseRangeList(0, cellCount, null);
            this._formats = new kendo.spreadsheet.SparseRangeList(0, cellCount, null);
            this._compiledFormulas = new kendo.spreadsheet.SparseRangeList(0, cellCount, null);
            this._styles = new kendo.spreadsheet.SparseRangeList(0, cellCount, null);
            this._rows = new kendo.spreadsheet.Axis(rowCount, rowHeight);
            this._columns = new kendo.spreadsheet.Axis(columnCount, columnWidth);
            this._mergedCells = [];
            this._frozenRows = 0;
            this._frozenColumns = 0;
            this._suspendChanges = false;
            this._selection = kendo.spreadsheet.NULLREF;
            this._activeCell = kendo.spreadsheet.FIRSTREF;
            this._grid = new kendo.spreadsheet.Grid(this._rows, this._columns, rowCount, columnCount, headerHeight, headerWidth);
            this._sorter = new kendo.spreadsheet.Sorter(this._grid, [this._values]);
        },

        name: function(value) {
            if (!value) {
                return this._name;
            }

            this._name = value;

            return this;
        },

        _property: function(accessor, value) {
            if (value === undefined) {
                return accessor();
            } else {
                accessor(value);

                return this.triggerChange();
            }
        },

        _field: function(name, value) {
            if (value === undefined) {
                return this[name];
            } else {
                this[name] = value;

                return this.triggerChange();
            }
        },

        suspendChanges: function(value) {
            if (value === undefined) {
                return this._suspendChanges;
            }

            this._suspendChanges = value;

            return this;
        },

        triggerChange: function(recalc) {
            if (!this._suspendChanges) {
                this.trigger("change", { recalc: recalc });
            }
            return this;
        },

        hideColumn: function(columnIndex) {
            return this._property(this._columns.hide.bind(this._columns), columnIndex);
        },

        unhideColumn: function(columnIndex) {
            return this._property(this._columns.unhide.bind(this._columns), columnIndex);
        },

        hideRow: function(rowIndex) {
            return this._property(this._rows.hide.bind(this._rows), rowIndex);
        },

        unhideRow: function(rowIndex) {
            return this._property(this._rows.unhide.bind(this._rows), rowIndex);
        },

        columnWidth: function(columnIndex, width) {
            return this._property(this._columns.value.bind(this._columns, columnIndex, columnIndex), width);
        },

        rowHeight: function(rowIndex, height) {
            return this._property(this._rows.value.bind(this._rows, rowIndex, rowIndex), height);
        },

        frozenRows: function(value) {
            return this._field("_frozenRows", value);
        },

        frozenColumns: function(value) {
            return this._field("_frozenColumns", value);
        },

        _ref: function(row, column, numRows, numColumns) {
            var ref = null;

            if (row instanceof kendo.spreadsheet.Ref) {
                return row;
            }

            if (typeof row === "string") {
                if (row.toLowerCase() === "#sheet") {
                    ref = kendo.spreadsheet.SHEETREF;
                } else {
                    ref = kendo.spreadsheet.calc.parseReference(row);
                }
            } else {
                if (!numRows) {
                    numRows = 1;
                }

                if (!numColumns) {
                    numColumns = 1;
                }
                ref = new RangeRef(new CellRef(row, column), new CellRef(row + numRows - 1, column + numColumns - 1));
            }

            return ref;
        },

        range: function(row, column, numRows, numColumns) {
            return new Range(this._ref(row, column, numRows, numColumns), this);
        },

        forEachMergedCell: function(callback) {
            this._mergedCells.forEach(callback);
        },

        forEach: function(ref, callback) {
            var topLeft = this._grid.normalize(ref.topLeft);
            var bottomRight = this._grid.normalize(ref.bottomRight);

            for (var ci = topLeft.col; ci <= bottomRight.col; ci ++) {
                var startCellIndex = this._grid.index(topLeft.row, ci);
                var endCellIndex = this._grid.index(bottomRight.row, ci);

                var values = this._values.iterator(startCellIndex, endCellIndex);
                var types = this._types.iterator(startCellIndex, endCellIndex);
                var formulas = this._formulas.iterator(startCellIndex, endCellIndex);
                var formats = this._formats.iterator(startCellIndex, endCellIndex);
                var styles = this._styles.iterator(startCellIndex, endCellIndex);

                for (var ri = topLeft.row; ri <= bottomRight.row; ri ++) {
                    var index = this._grid.index(ri, ci);

                    callback({
                        row: ri,
                        col: ci,
                        value: values.at(index),
                        type: types.at(index),
                        formula: formulas.at(index),
                        format: formats.at(index),
                        style: JSON.parse(styles.at(index))
                    });
                }
            }
        },

        values: function(ref, values) {
            var topLeftRow = ref.topLeft.row;
            var topLeftCol = ref.topLeft.col;
            var bottomRightRow = ref.bottomRight.row;
            var bottomRightCol = ref.bottomRight.col;
            var ci, ri, index;

            if (values === undefined) {
                values = new Array(ref.height());

                for (var vi = 0; vi < values.length; vi++) {
                    values[vi] = new Array(ref.width());
                }

                for (ci = topLeftCol; ci <= bottomRightCol; ci ++) {
                    var startCellIndex = this._grid.index(topLeftRow, ci);
                    var endCellIndex = this._grid.index(bottomRightRow, ci);

                    var iterator = this._values.iterator(startCellIndex, endCellIndex);

                    for (ri = topLeftRow; ri <= bottomRightRow; ri ++) {
                        index = this._grid.index(ri, ci);

                        values[ri - topLeftRow][ci - topLeftCol] = iterator.at(index);
                    }
                }

                return values;
            } else {
                for (ci = topLeftCol; ci <= bottomRightCol; ci ++) {
                    for (ri = topLeftRow; ri <= bottomRightRow; ri ++) {
                        index = this._grid.index(ri, ci);

                        var row = values[ri - topLeftRow];

                        if (row) {
                            var value = row[ci - topLeftCol];

                            if (value !== undefined) {
                                this._values.value(index, index, value);
                            }
                        }
                    }
                }

                return this.triggerChange();
            }
        },

        select: function(ref) {
            if (ref) {
                var mergedCells = this._mergedCells;

                this._selection = this._ref(ref).map(function(ref) {
                    return ref.toRangeRef().union(mergedCells);
                });

                this.activeCell(this._selection.first());
            }

            return this._selection;
        },

        activeCell: function(ref) {
            if (ref) {
                var mergedCells = this._mergedCells;

                this._activeCell = ref.map(function(ref) {
                    return ref.toRangeRef().union(mergedCells);
                });

                this.trigger("change");
            }

            return this._activeCell;
        },

        selection: function() {
            return new Range(this._grid.normalize(this._selection), this);
        },

        selectedHeaders: function() {
            var selection = this.select();

            var rows = {};
            var cols = {};
            var allCols = false;
            var allRows = false;

            selection.forEach(function(ref) {
                var i;
                var rowState = "active";
                var colState = "active";
                ref = ref.toRangeRef();

                var bottomRight = ref.bottomRight;

                var rowSelection = bottomRight.col === Infinity;
                var colSelection = bottomRight.row === Infinity;

                if (colSelection) { //column selection
                    allRows = true;
                    colState = "selected";
                }

                if (rowSelection) { //row selection
                    allCols = true;
                    rowState = "selected";
                }

                if (!colSelection) { //column selection
                    for (i = ref.topLeft.row; i <= bottomRight.row; i++) {
                        if (rows[i] !== "selected") {
                            rows[i] = rowState;
                        }
                    }
                }

                if (!rowSelection) {
                    for (i = ref.topLeft.col; i <= bottomRight.col; i++) {
                        if (cols[i] !== "selected") {
                            cols[i] = colState;
                        }
                    }
                }
            });

            return {
                rows: rows,
                cols: cols,
                allRows: allRows,
                allCols: allCols,
                all: allRows && allCols
            };
        },

        toJSON: function() {
            var positions = {};

            var rows = this._rows.toJSON("height", positions);
            var columns = this._columns.toJSON("width", {});

            this.forEach(kendo.spreadsheet.SHEETREF, function(data) {
                var value = data.value;
                var style = data.style;
                var formula = data.formula;
                var format = data.format;

                var hasValue = value !== null;
                var hasStyle = style !== null;
                var hasFormula = formula !== null;
                var hasFormat = format !== null;

                if (!hasValue && !hasStyle && !hasFormula && !hasFormat) {
                    return;
                }

                var position = positions[data.row];

                if (position === undefined) {
                    position = rows.length;

                    rows.push({ index: data.row });

                    positions[data.row] = position;
                }

                var row = rows[position];

                var cell = { index: data.col };

                if (hasValue) {
                    cell.value = value;
                }

                if (hasStyle) {
                    cell.style = style;
                }

                if (hasFormula) {
                    cell.formula = formula;
                }

                if (hasFormat) {
                    cell.format = format;
                }

                if (row.cells === undefined) {
                    row.cells = [];
                }

                row.cells.push(cell);
            });

            return {
                rows: rows,
                columns: columns,
                mergedCells: this._mergedCells.map(function(ref) {
                    return ref.toString();
                })
            };
        },

        fromJSON: function(json) {
            this.batch(function() {
                if (json.frozenColumns !== undefined) {
                    this.frozenColumns(json.frozenColumns);
                }

                if (json.frozenRows !== undefined) {
                    this.frozenRows(json.frozenRows);
                }

                if (json.columns !== undefined) {
                    this._columns.fromJSON("width", json.columns);
                }

                if (json.rows !== undefined) {
                    this._rows.fromJSON("height", json.rows);

                    for (var ri = 0; ri < json.rows.length; ri++) {
                        var row = json.rows[ri];
                        var rowIndex = row.index;

                        if (rowIndex === undefined) {
                            rowIndex = ri;
                        }

                        if (row.cells) {
                            for (var ci = 0; ci < row.cells.length; ci++) {
                                var cell = row.cells[ci];
                                var columnIndex = cell.index;

                                if (columnIndex === undefined) {
                                    columnIndex = ci;
                                }

                                if (cell.value !== null) {
                                    this.range(rowIndex, columnIndex).value(cell.value, false);
                                }

                                if (cell.style !== null) {
                                    this.range(rowIndex, columnIndex)._style(cell.style);
                                }

                                if (cell.formula !== null) {
                                    this.range(rowIndex, columnIndex).formula(cell.formula);
                                }

                                if (cell.format !== null) {
                                    this.range(rowIndex, columnIndex).format(cell.format);
                                }
                            }
                        }
                    }
                }

                if (json.mergedCells) {
                    json.mergedCells.forEach(function(ref) {
                       this.range(ref).merge();
                    }, this);
                }
            }.bind(this));
        },

        compiledFormula: function(ref) {
            var index = this._grid.cellRefIndex(ref);

            return this._compiledFormulas.value(index, index);
        },

        recalc: function(context) {
            var formulas = this._formulas.values();
            var compiledFormulas = [];

            formulas.forEach(function(formula) {
                for (var index = formula.start; index <= formula.end; index++) {
                    var cell = this._grid.cellRef(index);

                    var compiled = this._compiledFormulas.value(index, index);

                    if (compiled === null) {
                        var x = kendo.spreadsheet.calc.parse(this._name, cell.row, cell.col, formula.value);

                        compiled = kendo.spreadsheet.calc.compile(x);

                        this._compiledFormulas.value(index, index, compiled);
                    }

                    compiled.reset();

                    compiledFormulas.push({
                        cell: cell,
                        index: index,
                        formula: compiled
                    });
                }
            }, this);

            compiledFormulas.forEach(function(value) {
                value.formula.exec(context, this._name, value.cell.row, value.cell.col);
            }, this);
        },

        value: function(row, col, value) {
            if (value instanceof kendo.spreadsheet.calc.runtime.Matrix) {
                value.each(function(value, row, col) {
                    this._setValue(row, col, value);
                }.bind(this));
            } else {
                this._setValue(row, col, value);
            }
        },

        _setValue: function(row, col, value) {
            var result = this._parse(row, col, value, false);
            var index = this._grid.index(row, col);
            this._values.value(index, index, result.value);
            this._types.value(index, index, result.type);
        },

        _parse: function(row, col, value, parseStrings) {
            var type = null;

            if (value !== null) {
                if (value instanceof Date) {
                    value = kendo.spreadsheet.calc.runtime.dateToSerial(value);
                    type = "date";
                } else {
                    type = typeof value;
                    if (type === "string" && parseStrings !== false) {
                        var parseResult = kendo.spreadsheet.calc.parse(this._name, row, col, value);
                        value = parseResult.value;
                        type = parseResult.type;
                    }
                }
            }

            return {
                type: type,
                value: value
            };
        },

        batch: function(callback, recalc) {
            var suspended = this.suspendChanges();

            this.suspendChanges(true);

            callback();

            return this.suspendChanges(suspended).triggerChange(recalc);
        },

        _sort: function(ref, ascending, indices) {
            return this._sorter.sortBy(ref, this._values, ascending, indices);
        }
    });

    kendo.spreadsheet.Sheet = Sheet;
})(kendo);

}, typeof define == 'function' && define.amd ? define : function(_, f){ f(); });
