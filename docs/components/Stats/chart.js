import React, { Component, PropTypes } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import vg from 'vega'
import { debounce } from 'lodash'
import * as StatsActions from '../../actions/stats'

class Histogram extends Component {
  state = {
    vis: null,
    shift: false
  }

  _brushStart = null
  _brushEnd = null

  componentDidMount() {
    const { mode } = this.props

    this.initGraph(mode)

    document.addEventListener('keydown', ::this._onKey)
    document.addEventListener('keyup', ::this._onKey)
    document.addEventListener('mousedown', ::this._onMouse)
    document.addEventListener('mouseup', ::this._onMouse)
  }

  _onKey(event) {
    this.setState({
      shift: event.shiftKey ? 'shift' : ''
    })
  }
  _onMouse(event) {
    this.setState({
      shift: event.shiftKey && event.type === 'mousedown' ? 'shift-drag' : ''
    })
  }

  initGraph(mode) {
    const spec = this._spec(mode)

    vg.parse.spec(spec, chart => {
      const vis = chart({
        el: this.refs.chartContainer,
        renderer: 'svg'
      })

      vis.onSignal('brush_start', debounce(::this.setFilter, 50))
      vis.onSignal('brush_start_drag', debounce(::this.setFilter, 200))
      vis.onSignal('brush_end', debounce(::this.setFilter, 200))

      vis.data('activity').insert([]) // actual data comes later ^^
      vis.update()

      const _prevWindowOnresize = window.onresize
      window.onresize = function(...args) {
        _prevWindowOnresize && _prevWindowOnresize.apply(this, args)
        vis.width(window.innerWidth-90).update()
      }
      vis.width(window.innerWidth-90).update()

      this.setState({ vis })
    })
  }

  setFilter(signal, value) {
    const { actions, mode } = this.props
    if (signal === 'brush_start') {
      this._brushStart = value
    } else {
      if (signal === 'brush_end') {
        this._brushEnd = value
      }
      if (mode === 'recency') {
        if (this._brushStart - this._brushEnd === 0) {
          // startTime === endTime -> reset time filter
          actions.setTimeFilter(null)
        } else {
          actions.setTimeFilter([
            Math.min(this._brushStart, this._brushEnd)/1000,
            Math.max(this._brushStart, this._brushEnd)/1000
          ])
        }
      } else {
        if (this._brushStart - this._brushEnd === 0) {
          // startTime === endTime -> reset time filter
          actions.setExperienceFilter(null)
        } else {
          actions.setExperienceFilter([
            Math.pow(2, /*Math.floor*/(Math.min(this._brushStart, this._brushEnd))),
            Math.pow(2, /*Math.ceil */(Math.max(this._brushStart, this._brushEnd)))
          ])
        }
      }
    }
  }


  componentDidUpdate() {
    const { vis } = this.state
    const { data, mode } = this.props

    if (vis) {
      // update data in case it changed
      let bins = {}
      if (mode === 'recency') {
        data.forEach(feature => {
          if (feature.properties._count) {
            let samples = feature.properties._timestamps.split(';').map(Number)
            const countPerSample = feature.properties._count / samples.length
            samples.forEach(function(sample) {
              let day = new Date(sample*1000)
              day.setMilliseconds(0)
              day.setSeconds(0)
              day.setMinutes(0)
              day.setHours(0)
              day = +day
              if (!bins[day]) bins[day] = 0
              bins[day] += countPerSample
            })
          } else {
            let day = new Date(feature.properties._timestamp*1000)
            day.setMilliseconds(0)
            day.setSeconds(0)
            day.setMinutes(0)
            day.setHours(0)
            day = +day
            if (!bins[day]) bins[day] = 0
            bins[day]++
          }
        })
        bins = Object.keys(bins).map(day => ({
          day: +day,
          count_day: bins[day]
        }))
      } else {
        data.forEach(feature => {
          if (feature.properties._count) {
            let samples = feature.properties._userExperiences.split(';').map(Number)
            const countPerSample = feature.properties._count / samples.length
            samples.forEach(function(sample) {
              // todo: account for different scale range of user experience of different feautres !!!?!
              let experienceBin = Math.min(22, Math.floor(Math.log2(sample)))
              if (!bins[experienceBin]) bins[experienceBin] = 0
              bins[experienceBin] += countPerSample
            })
          } else {
            // todo: account for different scale range of user experience of different feautres !!!?!
            let experienceBin = Math.min(22, Math.floor(Math.log2(feature.properties._userExperience)))
            if (!bins[experienceBin]) bins[experienceBin] = 0
            bins[experienceBin]++
          }
        })
        bins = Object.keys(bins).map(experience => ({
          experience: +experience,
          count_experience: bins[experience]
        }))
      }

      vis.data('activity').remove(() => true).insert(bins)

      vis.update()
    }
  }

  render() {
    return (
      <div ref="chartContainer" className={"chart " + (this.state.shift || "")} title="click-drag to select date or experience range"/>
    )
  }


  _spec(mode) {
    const activityMode = mode === 'recency'
    return {
      "width": 1e6, // set initally very high to avoid non-updating clipping boundaries causing issues
      "height": 100,
      "padding": {"top": 10, "left": 40, "bottom": 30, "right": 5},

      "signals": [
        {
          "name": "shift",
          "init": false,
          "verbose": true,
          "streams": [
            {"type": "mousedown", "expr": "event.shiftKey"
          }]
        },
        {
          "name": "brush_start_drag",
          "init": -1,
          "streams": [{
            "type": "@start_marker:mousedown, [@start_marker:mousedown, window:mouseup] > window:mousemove",
            "expr": "iscale('x', clamp(eventX(), 0, width))"
          }, {
            "type": "@start_marker:mouseout", "expr": "-1"
          }]
        },
        {
          "name": "brush_end_drag",
          "init": -1,
          "streams": [{
            "type": "@end_marker:mousedown, [@end_marker:mousedown, window:mouseup] > window:mousemove",
            "expr": "iscale('x', clamp(eventX(), 0, width))"
          }, {
            "type": "@end_marker:mouseout", "expr": "-1"
          }]
        },
        {
          "name": "brush_start",
          "init": {},
          "streams": [{
            "type": "mousedown[!shift && brush_start_drag<0 && brush_end_drag<0]",
            "expr": "iscale('x', clamp(eventX(), 0, width))"
          }, {
            "type": "brush_start_drag",
            "expr": "brush_start_drag >=0 ? brush_start_drag : brush_start"
          }]
        },
        {
          "name": "brush_end",
          "init": {},
          "streams": [{
            "type": "mousedown[!shift && brush_start_drag<0 && brush_end_drag<0], [mousedown[!shift && brush_start_drag<0 && brush_end_drag<0], window:mouseup] > window:mousemove",
            "expr": "iscale('x', clamp(eventX(), 0, width))"
          }, {
            "type": "brush_end_drag",
            "expr": "brush_end_drag >=0 ? brush_end_drag : brush_end"
          }]
        },

        // panning
        {
          "name": "delta_start",
          "init": 0,
          "streams": [{
            "type": "mousedown[shift]",
            "expr": "eventX()"
          }]
        },
        {
          "name": "delta",
          "init": 0,
          "streams": [{
            "type": "[mousedown[shift], window:mouseup] > window:mousemove",
            "expr": "delta_start - eventX()"
          }]
        },


        {
          "name": "xAnchor",
          "init": 0,
          "streams": [{
            "type": "mousemove",
            "expr": activityMode
              ? "+datetime(iscale('x', clamp(eventX(), 0, width)))"
              : "iscale('x', clamp(eventX(), 0, width))"
          }]
        },
        {
          "name": "zoom",
          "init": 1.0,
          "verbose": true,
          "streams": [
            {"type": "wheel", "expr": "pow(1.01, event.deltaY*pow(16, event.deltaMode))"}
          ]
        },
        {
          "name": "xs",
          "streams": [{
            "type": "mousedown, mouseup, wheel",
            "expr": "{min: xMin, max: xMax}"}
          ]
        },
        {
          "name": "xMin",
          "init": activityMode
            ? +(new Date("2004-08-09"))
            : 0,
          "streams": [
            {
              "type": "delta",
              "expr": activityMode
                ? "max(+datetime(xs.min + (xs.max-xs.min)*delta/width), "+(+(new Date("2004-08-09")))+")"
                : "xs.min" //"max(xs.min + (xs.max-xs.min)*delta/width, 0)"
            },
            {
              "type": "zoom",
              "expr": activityMode
                ? "max(+datetime((xs.min-xAnchor)*zoom + xAnchor), "+(+(new Date("2004-08-09")))+")"
                : "xs.min" //"max((xs.min-xAnchor)*zoom + xAnchor, 0)"
            }
          ]
        },
        {
          "name": "xMax",
          "init": activityMode
            ? +(new Date())
            : 23,
          "streams": [
            {
              "type": "delta",
              "expr": activityMode
                ? "min(+datetime(+xs.max + (+xs.max-xs.min)*delta/width), "+(+(new Date()))+")"
                : "xs.max" //"min(xs.max + (xs.max-xs.min)*delta/width, 23)"
            },
            {
              "type": "zoom",
              "expr": activityMode
                ? "min(+datetime((xs.max-xAnchor)*zoom + xAnchor), "+(+(new Date()))+")"
                : "xs.max" //"min((xs.max-xAnchor)*zoom + xAnchor, 23)"
            }
          ]
        },
        {
          "name": "binWidth",
          "init": activityMode
            ? 2
            : 40,
          "streams": [{
            "type": "xMin",
            "expr": activityMode
              ? "max(width*86400000/(xMax-xMin), 2)"
              : "40" // todo: hmmm…
          }]
        }
      ],

      "data": [
        {
          "name": "activity",
          "format": {"type": "json", "parse": {"day": "date"}}
        },
      ],
      "scales": [
        {
          "name": "x",
          "type": activityMode
            ? "time"
            : "linear",
          "range": "width",
          "domain": {
            "data": "activity",
            "field": activityMode
              ? "day"
              : "experience"
          },
          "domainMin": {"signal": "xMin"},
          "domainMax": {"signal": "xMax"}
        },
        {
          "name": "experienceLabels",
          "type": "ordinal",
          "domain": [0,23],
          "range": ["beginner", "power mapper"]
        },
        {
          "name": "experienceLabelAligns",
          "type": "ordinal",
          "domain": [0,23],
          "range": ["left", "right"]
        },
        {
          "name": "y",
          "type": "linear",
          "range": "height",
          "domain": {
            "data": "activity",
            "field": activityMode
              ? "count_day"
              : "count_experience"
          }
        }
      ],
      "axes": [{
        "type": "x",
        "scale": "x",
        "grid": false,
        "layer": "back",
        "values": activityMode
          ? undefined
          : [0, 23],
        "tickSize": activityMode
          ? undefined
          : 0,
        "properties": {
           "axis": {
             "stroke": {"value": "#C2C2C2"},
             "strokeWidth": {"value": 1}
           },
           "ticks": {
             "stroke": {"value": "#C2C2C2"}
           },
           "majorTicks": {
             "strokeWidth": {"value": 2}
           },
          "labels": {
            "fontSize": {"value": 14},
            "fill": {"value": "#BCBCBC"},
            "text": activityMode
              ? undefined
              : {"scale": "experienceLabels"},
            "align": activityMode
              ? undefined
              : {"scale": "experienceLabelAligns"}
          }
        }
      }],
      "marks": [
        {
          "type": "group",
          "properties": {
            "enter": {
              "x": {"value": 0},
              "width": {"field": {"group": "width"}},
              "y": {"value": 0},
              "height": {"field": {"group": "height"}},
              "clip": {"value": true}
            }
          },
          "marks": [
            {
              "type": "rect",
              "from": {"data": "activity"},
              "properties": {
                "enter": {
                },
                "update": {
                  "x": {"scale": "x",
                    "field": activityMode
                      ? "day"
                      : "experience"
                  },
                  "width": {"signal": "binWidth"},
                  "y": {"scale": "y",
                    "field": activityMode
                      ? "count_day"
                      : "count_experience"
                  },
                  "y2": {"scale": "y", "value": 0},
                  "fill": [
                    {
                      "test": activityMode
                      ? "inrange(datum.day, brush_start, brush_end)"
                      : "inrange(datum.experience, brush_start, brush_end)",
                        "value": "#DADADA"
                    },
                    {"value": "#ACACAC"}
                  ]
                }
              }
            }
          ]
        },
        {
          "type": "group",
          "properties": {
            "enter": {
              "x": {"value": 0},
              "width": {"field": {"group": "width"}},
              "y": {"value": 0},
              "height": {"field": {"group": "height"}},
              "clip": {"value": false}
            }
          },
          "marks": [
            {
              "type": "rect",
              "properties": {
                "enter": {
                  "fill": {"value": "#72DDEF"},
                  "fillOpacity": {"value": 0.3}
                },
                "update": {
                  "x": {"scale": "x", "signal": "brush_start"},
                  "x2": {"scale": "x", "signal": "brush_end"},
                  "y": {"value": 30},
                  "height": {"value": 70}
                }
              }
            },
            {
              "type": "rect",
              "name": "start_marker",
              "properties": {
                "enter": {
                  "fill": {"value": "#BCE3E9"},
                  "fillOpacity": {"value": 1},
                  "stroke": {"value": "#000"},
                  "strokeOpacity": {"value": 0.0}
                },
                "update": {
                  "x": {"scale": "x", "signal": "brush_start"},
                  "width": [
                    { "test": "brush_start>brush_end || brush_start<brush_end", // == doesn't seem to work for whatever reason… wtf?
                      "value": 2
                    },
                    {"value": 0}
                  ],
                  "strokeWidth": [
                    { "test": "brush_start>brush_end || brush_start<brush_end", // == doesn't seem to work for whatever reason… wtf?
                      "value": 15
                    },
                    {"value": 0}
                  ],
                  "y": {"value": 30-8},
                  "height": {"value": 70+2*8}
                }
              }
            },
            {
              "type": "rect",
              "name": "end_marker",
              "properties": {
                "enter": {
                  "fill": {"value": "#BCE3E9"},
                  "fillOpacity": {"value": 1},
                  "stroke": {"value": "#000"},
                  "strokeOpacity": {"value": 0.0}
                },
                "update": {
                  "x": {"scale": "x", "signal": "brush_end"},
                  "width": [
                    { "test": "brush_start>brush_end || brush_start<brush_end",
                      "value": 2
                    },
                    {"value": 0}
                  ],
                  "strokeWidth": [
                    { "test": "brush_start>brush_end || brush_start<brush_end", // == doesn't seem to work for whatever reason… wtf?
                      "value": 15
                    },
                    {"value": 0}
                  ],
                  "y": {"value": 30-8},
                  "height": {"value": 70+2*8}
                }
              }
            }
          ]
        }
      ]
    }
  }
}


function mapStateToProps(state) {
  return {
    // todo: handle filters & overlays via state.map.*
  }
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(StatsActions, dispatch)
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Histogram)
