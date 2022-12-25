const unitSystems = {
  'SI': {
    distance: {
      descriptor: 'km',
      convert: l => l
    }
  },
  'Imperial': {
    distance: {
      descriptor: 'miles',
      convert: l => l*0.621371
    }
  },
  'Descriptive': {
    distance: {
      descriptor: 'trips to the moon',
      convert: l => l/385000
    }
  },
  'Atoms': {
    distance: {
      descriptor: 'Å',
      convert: l => l/1E-13
    }
  },
}

export default unitSystems
