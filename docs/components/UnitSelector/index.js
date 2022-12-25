import React, { Component } from 'react'
import DropdownButton from '../DropdownButton'

import unitSystems from '../../settings/unitSystems'


class UnitSelector extends Component {
  render() {
    var options = Object.keys(unitSystems).map(unitSystem => ({
      id: unitSystem,
      description: unitSystems[unitSystem][this.props.unit].descriptor
    })).filter(u => u.id !== 'Atoms')
    var unit = unitSystems[this.props.unitSystem][this.props.unit]
    var btn = <span className="descriptor" onDoubleClick={_ => this.handleDropdownChanges(['Atoms'])}>{unit.descriptor+this.props.suffix}&ensp;▾</span>
    return (
      <DropdownButton
        options={options}
        multiple={false}
        btnElement={btn}
        selectedKeys={[this.props.unitSystem]}
        onSelectionChange={::this.handleDropdownChanges}
        className="overlays-dropdown"
      />
    )
  }

  handleDropdownChanges(selectedKeys) {
    this.props.setUnitSystem(selectedKeys[0])
  }
}

export default UnitSelector
