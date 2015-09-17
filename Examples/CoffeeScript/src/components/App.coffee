React = require 'react-native'
{mat4} = require '../lib/gl-matrix'

{View, Text, StyleSheet} = React

degressToRadians = (deg) -> deg * (Math.PI / 180)
radiansToDegrees = (rad) -> rad * (180 / Math.PI)

getTransformMatrix = (rotation) ->
  m1 = mat4.create()
  m2 = mat4.create()
  m2 = mat4.rotateZ m2, m1, rotation
  [].slice.apply m2

App = React.createClass

  getInitialState: () ->
    {rotation: 0}

  componentDidMount: ->
    do @onTick

  onTick: ->
    inc = 1
    degrees = radiansToDegrees(@state.rotation) - inc
    rotation = degressToRadians degrees
    @setState {rotation}
    requestAnimationFrame @onTick

  render: ->
    boxStyle =
      width: 200
      height: 200
      backgroundColor: 'purple'
      transformMatrix: getTransformMatrix(@state.rotation)

    <View style={styles.container}>
      <View style={boxStyle} />
    </View>

styles = StyleSheet.create
  container:
    flex: 1
    alignItems: 'center'
    justifyContent: 'center'
    backgroundColor: 'lightgreen'

module.exports = App