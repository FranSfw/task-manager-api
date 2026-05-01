export class FormControl {
    constructor(value = '', validators = [], asyncValidators = []) {
        this.value = value;
        this.validators = Array.isArray(validators) ? validators : [validators];
        this.asyncValidators = Array.isArray(asyncValidators) ? asyncValidators : [asyncValidators];
        this.errors = null;
        this.touched = false;
        this.dirty = false;
        this.valid = true;
        this.invalid = false;
        this.pending = false;
        this._statusSubscribers = [];
        this._valueSubscribers = [];
        // No update immediately to allow group initialization
    }

    setValue(value) {
        this.value = value;
        this.dirty = true;
        this._valueSubscribers.forEach(cb => cb(this.value));
        this.updateValueAndValidity();
    }

    markAsTouched() {
        this.touched = true;
        this._statusSubscribers.forEach(cb => cb());
    }

    async updateValueAndValidity() {
        this.errors = null;
        
        // Sync Validators
        for (let validator of this.validators) {
            if (!validator) continue;
            let error = validator(this);
            if (error) {
                this.errors = { ...this.errors, ...error };
            }
        }

        if (this.errors) {
            this.valid = false;
            this.invalid = true;
            this._statusSubscribers.forEach(cb => cb());
            return;
        }

        // Async Validators
        if (this.asyncValidators.length > 0) {
            this.pending = true;
            this._statusSubscribers.forEach(cb => cb());
            for (let asyncValidator of this.asyncValidators) {
                if (!asyncValidator) continue;
                let error = await asyncValidator(this);
                if (error) {
                    this.errors = { ...this.errors, ...error };
                }
            }
            this.pending = false;
        }

        this.valid = this.errors === null;
        this.invalid = !this.valid;
        this._statusSubscribers.forEach(cb => cb());
    }

    statusSubscribe(cb) {
        this._statusSubscribers.push(cb);
    }
    
    valueSubscribe(cb) {
        this._valueSubscribers.push(cb);
    }
}

export class FormGroup {
    constructor(controls) {
        this.controls = controls;
        this.value = {};
        this.valid = true;
        this.invalid = false;
        this.pending = false;
        this.errors = null;
        this._statusSubscribers = [];
        
        Object.keys(this.controls).forEach(key => {
            const control = this.controls[key];
            control.statusSubscribe(() => this.updateValueAndValidity());
        });
        this.updateValueAndValidity();
    }

    get(path) {
        return this.controls[path];
    }

    markAllAsTouched() {
        Object.values(this.controls).forEach(control => {
            if (control.markAllAsTouched) {
                control.markAllAsTouched();
            } else {
                control.markAsTouched();
            }
        });
        this.updateValueAndValidity();
    }

    updateValueAndValidity() {
        this.valid = true;
        this.pending = false;
        this.errors = null;
        Object.keys(this.controls).forEach(key => {
            const control = this.controls[key];
            this.value[key] = control.value;
            if (control.invalid) this.valid = false;
            if (control.pending) this.pending = true;
            if (control.errors) {
                if (!this.errors) this.errors = {};
                this.errors[key] = control.errors;
            }
        });
        
        // Custom group validators like cross-field could go here
        if (this.validator) {
            const err = this.validator(this);
            if (err) {
                this.errors = { ...this.errors, ...err };
                this.valid = false;
            }
        }
        
        this.invalid = !this.valid;
        this._statusSubscribers.forEach(cb => cb());
    }

    statusSubscribe(cb) {
        this._statusSubscribers.push(cb);
    }
}

export class FormArray {
    constructor(controls = []) {
        this.controls = controls;
        this.valid = true;
        this.invalid = false;
        this.pending = false;
        this.value = [];
        this._statusSubscribers = [];
        this.updateValueAndValidity();
    }

    push(control) {
        this.controls.push(control);
        control.statusSubscribe(() => this.updateValueAndValidity());
        this.updateValueAndValidity();
    }

    removeAt(index) {
        this.controls.splice(index, 1);
        this.updateValueAndValidity();
    }

    markAllAsTouched() {
        this.controls.forEach(control => {
            if (control.markAllAsTouched) {
                control.markAllAsTouched();
            } else {
                control.markAsTouched();
            }
        });
    }

    updateValueAndValidity() {
        this.valid = true;
        this.pending = false;
        this.value = [];
        this.controls.forEach(control => {
            this.value.push(control.value);
            if (control.invalid) this.valid = false;
            if (control.pending) this.pending = true;
        });
        this.invalid = !this.valid;
        this._statusSubscribers.forEach(cb => cb());
    }
    
    statusSubscribe(cb) {
        this._statusSubscribers.push(cb);
    }
}

export const Validators = {
    required: (control) => control.value ? null : { required: true },
    email: (control) => {
        if (!control.value) return null;
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(control.value) ? null : { email: true };
    },
    min: (minVal) => (control) => {
        if (!control.value) return null;
        return Number(control.value) >= minVal ? null : { min: true };
    }
};
