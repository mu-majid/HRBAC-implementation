let rolesConfig = require('./Example');

// rbac.can('user', 'post:delete', {id: 1, ownerId: 2}) // request user not owner
//   .then(result => {
//     console.log('Result > ', result);
//   })
//   .catch(e => {
//     console.log('error > ', e);
    
//   })

function loadRoles () {
  return new Promise(function (resolve, reject) {
    setTimeout(() => {
      resolve(rolesConfig);
    }, 2000);
  });
}

let rbac = require('./RBAC').create(loadRoles());


rbac.can('admin', 'account:add', {userId: 1, ownerId: 1}) // request user not owner
  .then(result => {
    console.log('Result > ', result);
  })
  .catch(e => {
    console.log('error > ', e);
    
  })

