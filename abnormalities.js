const DEBUG = false

const abnormals = require('./config/abnormalities')

class AbnormalityPrediction {
	constructor(dispatch) {
		this.dispatch = dispatch

		this.cid = null
		this.myAbnormals = {}

		dispatch.hook('S_LOGIN', 1, event => {
			this.cid = event.cid
			this._removeAll()
		})

		dispatch.hook('C_RETURN_TO_LOBBY', 1, () => { this._removeAll() })

		dispatch.hook('S_CREATURE_LIFE', 1, event => {
			if(event.target.equals(this.cid) && !event.alive) this._removeAll()
		})

		let abnormalityUpdate = (type, event) => {
			if(event.target.equals(this.cid)) {
				if(DEBUG) console.log('<-', type, event.id, event.duration, event.stacks, abnormals[event.id] == true ? 'X' : '')

				let info = abnormals[event.id]
				if(info) {
					if(info == true) return false

					if(info.overrides && this.exists(info.overrides)) this.remove(info.overrides)
				}

				if(type == 'S_ABNORMALITY_BEGIN' && this.exists(event.id)) {
					this.add(event.id, event.duration, event.stacks)
					return false
				}

				this._add(event.id, event.duration)
			}
		}

		dispatch.hook('S_ABNORMALITY_BEGIN', 2, abnormalityUpdate.bind(null, 'S_ABNORMALITY_BEGIN'))
		dispatch.hook('S_ABNORMALITY_REFRESH', 1, abnormalityUpdate.bind(null, 'S_ABNORMALITY_REFRESH'))

		dispatch.hook('S_ABNORMALITY_END', 1, event => {
			if(event.target.equals(this.cid)) {
				if(DEBUG) console.log('<- S_ABNORMALITY_END', event.id, abnormals[event.id] == true ? 'X' : '')

				if(abnormals[event.id] == true) return false

				if(!this.myAbnormals[event.id]) return false

				this._remove(event.id)
			}
		})
	}

	exists(id) {
		return !!this.myAbnormals[id]
	}

	add(id, duration, stacks) {
		let type = this.myAbnormals[id] ? 'S_ABNORMALITY_REFRESH' : 'S_ABNORMALITY_BEGIN',
			version = this.myAbnormals[id] ? 1 : 2

		if(DEBUG) console.log('<*', type, id, duration, stacks)

		this.dispatch.toClient(type, version, {
			target: this.cid,
			source: this.cid,
			id,
			duration,
			unk: 0,
			stacks,
			unk2: 0
		})

		this._add(id, duration)
	}

	remove(id) {
		if(!this.exists(id)) return

		if(DEBUG) console.log('<* S_ABNORMALITY_END', id)

		this.dispatch.toClient('S_ABNORMALITY_END', 1, {
			target: this.cid,
			id
		})

		this._remove(id)
	}

	_add(id, duration) {
		clearTimeout(this.myAbnormals[id])
		this.myAbnormals[id] = duration >= 0x7fffffff ? true : setTimeout(() => { this.remove(id) }, duration)
	}

	_remove(id) {
		clearTimeout(this.myAbnormals[id])
		delete this.myAbnormals[id]
	}

	_removeAll() {
		if(Object.keys(this.myAbnormals).length) {
			for(let id in this.myAbnormals) clearTimeout(this.myAbnormals[id])

			this.myAbnormals = {}
		}
	}
}

module.exports = AbnormalityPrediction