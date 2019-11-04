const {any, globToRegex, isGlob} = require('./helpers');

class RBAC {
  constructor(roles) {
    // if roles is function => async loading, if object then sync loading.
    this._inited = false;
    if (typeof roles !== 'function' && typeof roles.then !== 'function') {
      console.log('Sync Loading');

      this.roles = this.init(roles);
      this._inited = true;
    }
    else {
      console.log('Async Loading');
      // Will await on it, when `can` method is called (maybe user will call `can` long after instantiating the class, so no need to await in the begining)
      this._init = this.asyncInit(roles); 
    }
  }

  init (roles) {
    if (typeof roles !== 'object') {
      throw new TypeError('Expected Roles to be an object');
    }
    let map = new Map();

    Object.keys(roles).forEach(role => {
      let roleObj = {
        can: {},
        canGlob: []
      };

      // Validate Can Defintion
      if (!Array.isArray(roles[role].can)) {
        throw new TypeError('Expected roles[' + role + '].can to be an array');
      }

      if (roles[role].inherits) {

        if(!Array.isArray(roles[role].inherits)) {
          throw new TypeError('Expected roles[' + role + '].inherits to be an array');
        }

        roleObj.inherits = [];
        roles[role].inherits.forEach(child => {
          if(typeof child !== 'string') {
            throw new TypeError('Expected roles[' + role + '].inherits element');
          }
          if(!roles[child]) {
            throw new TypeError('Undefined inheritance role: ' + child);
          }
          roleObj.inherits.push(child);
        });
      }

      roles[role].can.forEach(operation => {
        if (typeof operation === 'string') {
          if(!isGlob(operation)) {
            roleObj.can[operation] = 1;
          } else {
            roleObj.canGlob.push({ name: globToRegex(operation), original: operation });
          }
          return;
        }
        else if (typeof operation.name === 'string' && typeof operation.when === 'function'){

          if(!isGlob(operation.name)) {
            roleObj.can[operation.name] = operation.when;
          } else {
            roleObj.canGlob.push({ name: globToRegex(operation.name), original: operation.name, when: operation.when });
          }
          return;
        }
        throw new TypeError('Unexpected operation type', operation);
        // ignore defintion we don't know..
      })

      map.set(role, roleObj);
    });

    return map;
  }

  async asyncInit(roles) {
    if (typeof roles === 'function') {
      roles = await roles(); // async function that retrieve roles config from either a DB or an API 
    }

    if (typeof roles.then === 'function') {
      roles = await roles; // wait for the promise to resolve
    }

    // Add roles to class and mark as inited
    this.roles = this.init(roles);
    this._inited = true;
  }

  async can (role, operation, params) {

    // check async init is complete or not
    if (!this._inited) {
      console.log('Still trying to retrieve Roles Configuration...');
      await this._init;
      console.log('Done Loading Roles.');
    }

    // if role input is an array
    if (Array.isArray(role)) {
      console.log('array of roles, try all');
      return any(role.map(r => this.can(r, operation, params)));
    }

    // checks on data types

    if (typeof role !== 'string') {
      console.log('Expected first parameter to be string : role');
      return false;
    }

    if (typeof operation !== 'string') {
      console.log('Expected second parameter to be string : operation');
      return false
    }

  
    let roleObj = this.roles.get(role);
    // check role exist
    if (!roleObj) {
      console.log('Undefined Role ', roleObj);
      return false;
    }

    // operation could be string or function

    // role can do operation
    if (roleObj.can[operation] === 1) {
      console.log('Resolved.');
      return true;
    }

     // Operation is conditional, run async function
    if (typeof roleObj.can[operation] === 'function') {

      console.log('Operation is conditional, run fn');
      try {
        return roleObj.can[operation](params);
      }
      catch (e) {
        console.log('conditional function threw', e);
        return false;
      }
    }

    // operation is not defined at current level try higher
    if (!roleObj.can[operation] && !roleObj.canGlob.find(glob => glob.name.test(operation))) {
      console.log('Not allowed at this level, try higher');
      // If no parents reject
      if (!roleObj.inherits || roleObj.inherits.length < 1) {
        console.log('No inherit, reject false');
        return false;
      }
      // Return if any parent resolves true or all reject
      return any(roleObj.inherits.map(parent => {
        console.log('Try from ' + parent);
        return this.can(parent, operation, params);
      }));
    }

    // Try globals
    let globMatch = roleObj.canGlob.find(glob => glob.name.test(operation));

    if(globMatch && !globMatch.when) {
      console.log(`We have a globmatch (${globMatch.original}), resolve`);
      return true;
    }

    if(globMatch && globMatch.when) {
      console.log(`We have a conditional globmatch (${globMatch.original}), run fn`);
      try {
        return globMatch.when(params);
      }
      catch (e) {
        console.log('conditional function threw', e);
        return false;
      }
    }



    console.log('Shouldnt have reached here, something wrong, reject');
    throw new Error('something went wrong');
  }


}

RBAC.create = function create(opts) {
  return new RBAC(opts);
}

module.exports = RBAC;


