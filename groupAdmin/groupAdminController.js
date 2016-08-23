angular.module('algorea').directive('field', function() {
   return {
      restrict: 'E',
      scope: {
         model: '=',
         readonly: '@',
         onchange: '&'
      },
      link: function(scope, elem, attrs) {
         var parts = attrs.field.split(".");
         scope.field = models[parts[0]].fields[parts[1]];
         scope.fieldname = parts[1];
         if (!scope.onchange) {
            scope.onchange = function() {};
         }
      },
      controller: ['$scope', function($scope) {
         $scope.clear = function() {
            if ($scope.field.type == "jsdate") {
               $scope.model[$scope.fieldname] = null;
            }
         };
      }],
      templateUrl: "commonFramework/angularDirectives/formField.html",
      replace: true
   };
});

angular.module('algorea').
  filter('byRequest', function() {
    return function(children) {
      var out = [];
      angular.forEach(children, function(child) {
         if (child.sType == 'requestSent') {
            out.push(child);
         }
      });
      return out;
    };
  });

angular.module('algorea').
  filter('invitation', function() {
    return function(children) {
      var out = [];
      angular.forEach(children, function(child) {
         if (child.sType == 'invitationSent' || child.sType == 'invitationRefused') {
            out.push(child);
         }
      });
      return out;
    };
  });

angular.module('algorea').
  filter('confirmed', function() {
    return function(children) {
      var out = [];
      angular.forEach(children, function(child) {
         if (child.sType == 'direct' || child.sType == 'requestAccepted' || child.sType == 'invitationAccepted') {
            out.push(child);
         }
      });
      return out;
    };
  });

angular.module('algorea').
  filter('userSort', function() {
    return function(groups_groups, parent, owned) {
      var res = _.sortBy(groups_groups, function(g_g) {
         var group = parent ? g_g.parent : g_g.child;
         var user = owned ? group.userOwned : group.userSelf;
         return user ? user.sLogin : '';
      });
      return res;
    };
  });

angular.module('algorea')
   .controller('groupAdminBreadCrumbsController', ['$scope', '$stateParams', function ($scope, $stateParams) {
   'use strict';
   $scope.groupName = 'chargement...';
   if ($stateParams.idGroup == 'new') {
      $scope.groupName = 'Nouveau groupe';
   }
   $scope.$on('algorea.groupSynced', function() {
      var groupId = $stateParams.idGroup;
      $scope.group = ModelsManager.getRecord('groups', groupId);
      if (!$scope.group) {
         $scope.group = {sName: 'error!'};
         return;
      }
   });
}]);

angular.module('algorea')
   .controller('groupAdminPopupController', ['$scope', '$uibModalInstance', 'popupData', function ($scope, $uibModalInstance, popupData) {
   'use strict';
   if (popupData) {
      $scope.user_item = popupData.user_item;
      $scope.item = popupData.item;
      $scope.thread = popupData.thread;
   }
   $scope.inPopup = true;
   $scope.close = function () {
      $uibModalInstance.close();
   };
}]);

angular.module('algorea')
   .controller('groupAdminController', ['$scope', '$stateParams', 'itemService', '$uibModal', '$http', '$rootScope', '$state', '$timeout', '$filter', function ($scope, $stateParams, itemService, $uibModal, $http, $rootScope, $state, $timeout, $filter) {
   'use strict';
   $scope.error = null;

   $scope.layout.isOnePage(true);
   $scope.layout.hasMap('never');
   $scope.groupFields = models.groups.fields;
   
   function getThread(user_item) {
      if (!user_item.item) {
         return null;
      }
      var res = null;
      angular.forEach(user_item.item.threads, function(thread) {
         if (thread.idUser == user_item.idUser) {
            res = thread;
            return false;
         }
      });
      return res;
   }

   $scope.openPopup = function(user_item) {
      var thread = getThread(user_item);
      var my_user_item = itemService.getUserItem(user_item.item);
      var item = user_item.item;
      if (my_user_item && (my_user_item.bValidated || item.bAccessSolutions || item.bOwnerAccess || item.bManagerAccess)) {
         var popupData = {
               user_item: user_item,
               thread: thread,
               readOnlyIfNoThread: true,
               item: user_item.item
            };
         $uibModal.open({
            template: '<button type="button" class="close" data-dismiss="modal" aria-hidden="true" ng-click="close();" style="padding-right:5px;">&times;</button><div ng-include="\'forum/thread.html\'" ng-controller="forumThreadController" class="forum-in-task" id="forum-in-task"></div>',
            controller: 'groupAdminPopupController',
            resolve: {popupData: function () { return popupData; }},
            windowClass: 'groupAdmin-modal'
          });
      } else {
         $uibModal.open({
            template: '<button type="button" class="close" data-dismiss="modal" aria-hidden="true" ng-click="close();" style="padding-right:5px;">&times;</button>Vous n\'avez pas validé cet exercice et vous n\'avez pas les droits suffisants pour voir les soumissions',
            controller: 'groupAdminPopupController',
            resolve: {popupData: function () {}},
          });
      }
   };

   $scope.getClass = function(userItem) {
      if (!userItem || !userItem.sLastActivityDate) {
         return 'unread';
      }
      if (userItem.bValidated) {
         if (userItem.iScore != 100 && userItem.item.sType == 'Task') {
            return 'validated_partial';
         }
         return 'validated';
      } else {
         if (userItem.nbSubmissionsAttempts && userItem.item.sType == 'Task') {
            return 'failed';
         }
         return 'read';
      }

   }

   $scope.numberOfEvents = 10;

   var getTypeString = function(type, userItem) {
      if (type == 'hint') {
         return userItem.nbHintsCached+'e. demande d\'indice';
      }
      if (type == 'answer') {
         return userItem.nbSubmissionsAttempts+'e. soumission d\'une réponse';
      }
      if (type == 'validation') {
         return 'validation';
      }
      if (type == 'newThread') {
         return 'demande d\'aide sur le forum';
      }
   };

   var durationToStr = function(date1, date2) {
      if (!date2 || !date1) return '-';
      var timeDiffMs = Math.abs(date2.getTime() - date1.getTime());
      var diffHours = Math.floor(timeDiffMs / (1000 * 3600));
      if (diffHours < 24) {
         var diffMinutes = Math.floor(timeDiffMs / (1000 * 60));
         if (diffMinutes < 60) {
            return diffMinutes+'mn';
         }
         diffMinutes = diffMinutes - 60*diffHours;
         return diffHours+'h '+diffMinutes+'mn';
      }
      var diffDays = Math.floor(timeDiffMs / (1000 * 3600 * 24));
      if (diffDays < 90) {
         return '> '+diffDays+' jours';
      }
      var diffMonth = Math.floor(timeDiffMs / (1000 * 3600 * 24 * 30));
      if (diffMonth < 24) {
         return '> '+diffMonth+' mois';
      }
      var diffYear = Math.floor(timeDiffMs / (1000 * 3600 * 24 * 365));
      return '> '+diffYear+' ans';
   }

   $scope.getDuration = function(user_item) {
      if (!user_item || !user_item.sStartDate || user_item.sStartDate.getYear() < 100) {
         return '-';
      }
      if (user_item.bValidated) {
         return durationToStr(user_item.sStartDate, user_item.sValidationDate);
      }
      var now = new Date();
      return durationToStr(user_item.sStartDate, now);
   }

   $scope.getDate = function(user_item) {
      if (!user_item || !user_item.sStartDate || user_item.sStartDate.getYear() < 100) {
         return '-';
      }
      if (user_item.sValidationDate) {
         return $filter('date')(new Date(user_item.sValidationDate), 'dd/MM/yyyy');
      }
      if (user_item.sLastActivityDate) {
         return $filter('date')(new Date(user_item.sLastActivityDate), 'dd/MM/yyyy');
      }
      return '-';
   }

   function getUserStr(user) {
      if (!user) {
         return 'Utilisateur inconnu';
      }
      var res = user.sLogin;
      if (user.sFirstName || user.sLastName) {
         res += ' (';
      }
      if (user.sFirstName) {
         res += user.sFirstName + (user.sLastName ? ' ' : '');
      }
      if (user.sLastName) {
         res += user.sLastName;
      }
      if (user.sFirstName || user.sLastName) {
         res += ')';
      }
      return res;
   }

   var insertEvent = function(userItem, type, date) {
      var eventStr = getTypeString(type, userItem);
      var userStr = getUserStr(userItem.user);
      var event = {
         'date': date,
         'userStr': userStr,
         'eventStr': eventStr,
         'itemStr': userItem.item.strings[0].sTitle,
         'user_item': userItem
      };
      // insertion in a sorted array:
      $scope.events.splice(_.sortedIndexBy($scope.events, event, function(event) {return event.date;}), 0, event);
      if ($scope.events.length > $scope.numberOfEvents) {
         $scope.events.shift();
         $scope.oldestEventDate = $scope.events[$scope.events.length-1].date;   
      }
   };

   $scope.updateEvents = function() {
      $scope.events = [];
      $scope.oldestEventDate = new Date("2012-01-15");
      var usersItems = ModelsManager.curData.users_items;
      angular.forEach(usersItems, function(userItem) {
         if (!$scope.usersSelected[userItem.idUser] || !$scope.itemsListRev[userItem.idItem]) {
            return;
         }
         if (userItem.sValidationDate > $scope.oldestEventDate) {
            insertEvent(userItem, 'validation', userItem.sValidationDate);
         }
         if (userItem.sLastAnswerDate > $scope.oldestEventDate && userItem.sLastAnswerDate != userItem.sValidationDate) {
            insertEvent(userItem, 'answer', userItem.sLastAnswerDate);
         }
         if (userItem.item.sType == 'task' && userItem.sLastHintDate > $scope.oldestEventDate) {
            insertEvent(userItem, 'hint', userItem.sLastHintDate);
         }
         if (userItem.sThreadStartDate > $scope.oldestEventDate) {
            insertEvent(userItem, 'newThread', userItem.sThreadStartDate);  
         }
      });
      _.reverse($scope.events);
   };

   var needToUpdateAtEndOfSync = false;
   ModelsManager.addListener('users_items', 'deleted', 'groupAdminDeleted', function() {needToUpdateAtEndOfSync = true;});
   ModelsManager.addListener('users_items', 'inserted', 'groupAdminInserted', function() {needToUpdateAtEndOfSync = true;});
   ModelsManager.addListener('users_items', 'updated', 'groupAdminUpdated', function() {needToUpdateAtEndOfSync = true;});

   $scope.invitationError = null;
   $scope.newInvitationOpened = false;
   $scope.formValues = {};
   $scope.hasObjectChanged = function(modelName, record) {
      if (!record) {
         return false;
      }
      return ModelsManager.hasRecordChanged(modelName, record.ID);
   };
   $scope.newInvitation = function() {
      $scope.newInvitationOpened = true;
   };
   $scope.confirmInvitation = function() {
      $scope.newInvitationOpened = false;
   };
   $scope.showTable = function() {
      var res = false;
      angular.forEach($scope.group.children, function(child) {
         if (child.sType != 'direct') {
            res = true;
            return false;
         }
      });
      return res;
   };

   $scope.updateGroupsGroups = function() {
      $scope.showRequestTable = false;
      $scope.showInvitationTable = false;
      angular.forEach($scope.group.children, function(child) {
         if (child.sType == 'requestSent') {
            $scope.showRequestTable = true;
            return;
         }
         if (child.sType == 'invitationSent' || child.sType == 'invitationRefused') {
            $scope.showInvitationTable = true;
         }
      });
   }

   var needToUpdateGroupsGroupsAtEndOfSync = false;
   ModelsManager.addListener('groups_groups', 'updated', 'groupAdminGpsGpsDeleted', function() {needToUpdateGroupsGroupsAtEndOfSync = true;}, true);
   ModelsManager.addListener('groups_groups', 'inserted', 'groupAdminGpsGpsInserted', function() {needToUpdateGroupsGroupsAtEndOfSync = true;}, true);
   ModelsManager.addListener('groups_groups', 'deleted', 'groupAdminGpsGpsDeleted', function() {needToUpdateGroupsGroupsAtEndOfSync = true;}, true);

   $scope.printType = function(type) {
      return models.groups_groups.fields.sType.values[type].label;
   };
   $scope.cancelInvitation = function(group_group) {
      ModelsManager.deleted('groups_groups', group_group.ID);
      $scope.updateGroupsGroups();
   };
   $scope.acceptRequest = function(group_group) {
      group_group.sType = 'requestAccepted';
      group_group.sStatusDate = new Date();
      ModelsManager.updated('groups_groups', group_group.ID);
      $scope.updateGroupsGroups();
   };
   $scope.refuseRequest = function(group_group) {
      group_group.sType = 'requestRefused';
      group_group.sStatusDate = new Date();
      ModelsManager.updated('groups_groups', group_group.ID);
      $scope.updateGroupsGroups();
   };
   $scope.inviteLogins = function() {
      if (!$scope.formValues.currentLogins) {
         return;
      }
      var logins = $scope.formValues.currentLogins.split(' ');
      $scope.invitationError = '';
      $http.post('/admin/invitations.php', {action: 'getGroupsFromLogins', logins: logins}, {responseType: 'json'}).success(function(postRes) {
         if (!postRes || !postRes.success) {
            console.error("got error from invitation handler: "+postRes.error);
         } else {
            if (postRes.loginsNotFound.length) {
               $scope.invitationError = "Les logins suivants n'ont pas pu être trouvés : "+postRes.loginsNotFound.join(' ')+'. ';
            }
            var alreadyInvitedLogins = [];
            var alreadyInvitedGroupIds = {};
            angular.forEach($scope.group.children, function(child, ID) {
               alreadyInvitedGroupIds[child.idGroupChild] = ID;
            });
            angular.forEach(postRes.logins_groups, function(groupId, login) {
               if (alreadyInvitedGroupIds[groupId]) {
                  var child = $scope.group.children[alreadyInvitedGroupIds[groupId]];
                  if (child.sType == 'invitationSent' || child.sType == 'invitationAccepted' || child.sType == 'requestSent' || child.sType == 'requestAccepted' || child.sType == 'direct') {
                     alreadyInvitedLogins.push(login);
                  } else {
                     child.sType = 'invitationSent';
                     child.sStatusDate = new Date();
                     ModelsManager.updated('groups_groups', child.ID);
                  }
               } else {
                  $scope.createInvitation(groupId, login);
               }
            });
            if (alreadyInvitedLogins.length) {
               $scope.invitationError += 'Les logins suivants ont déjà reçu une invitation ou font déjà partie du groupe : '+alreadyInvitedLogins.join(' ')+'. ';
            }
            $scope.formValues.currentLogins = '';
         }
      })
      .error(function() {
         console.error("error calling invitations.php");
      });
   };

   $scope.inviteAdminLogins = function() {
      if (!$scope.formValues.adminLogins) {
         return;
      }
      var logins = $scope.formValues.adminLogins.split(' ');
      $scope.adminLoading = true;
      $http.post('/admin/invitations.php', {action: 'getAdminGroupsFromLogins', logins: logins, idGroup: $scope.group.ID}, {responseType: 'json'}).success(function(postRes) {
         if (!postRes || !postRes.success) {
            console.error("got error from admin invitation handler: "+postRes.error);
         } else {
            if (postRes.loginsNotFound.length) {
               $scope.adminInvitationError = "Les logins suivants n'ont pas pu être trouvés : "+postRes.loginsNotFound.join(' ')+'. ';
            }
            var alreadyInvitedLogins = [];
            var alreadyInvitedGroupIds = {};
            angular.forEach($scope.group.parents, function(parent, ID) {
               alreadyInvitedGroupIds[parent.idGroupParent] = ID;
            });
            var groupsToInvite = [];
            angular.forEach(postRes.logins_groups, function(groupId, login) {
               if (alreadyInvitedGroupIds[groupId]) {
                  alreadyInvitedLogins.push(login);
               } else {
                  groupsToInvite.push(groupId);
               }
            });
            if (alreadyInvitedLogins.length) {
               $scope.adminInvitationError += 'Les logins suivants ont déjà un rôle dans le groupe : '+alreadyInvitedLogins.join(' ')+'. ';
            }
            if (groupsToInvite.length) {
               $scope.addAdminGroups(groupsToInvite);
            } else {
               $scope.adminLoading = false;
            }
         }
      })
      .error(function() {
         console.error("error calling invitations.php");
      });
   };

   $scope.getNextiChildOrder = function(group) {
      var res = 0;
      angular.forEach(group.children, function(child, ID) {
         var idInt = parseInt(ID);
         if (idInt >= res) {
            res = idInt+1;
         }
      });
      return res;
   };

   $scope.createInvitation = function(groupId, childLogin) {
      var invitation = ModelsManager.createRecord('groups_groups');
      invitation.idGroupParent = $scope.group.ID;
      invitation.idGroupChild = groupId;
      invitation.idGroupParent = $scope.group.ID;
      invitation.idUserInviting = SyncQueue.requests.loginData.ID;
      invitation.sChildLogin = childLogin;
      invitation.iChildOrder = $scope.getNextiChildOrder($scope.group);
      invitation.sType = 'invitationSent';
      invitation.sStatusDate = new Date();
      ModelsManager.insertRecord('groups_groups', invitation);
   };

   $scope.generatePassword = function() {
      var string = '';
      var stringOfAllowedChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      for (var i = 0; i < 10;  i++) {
         string += stringOfAllowedChars.charAt(Math.floor(Math.random()*stringOfAllowedChars.length));
      }
      return string;
   }

   $scope.passwordChecked = function() {
      if ($scope.formValues.hasPassword) {
         if ($scope.oldPassword) {
            $scope.group.sPassword = $scope.oldPassword;
            $scope.saveGroup();
         } else {
            $scope.refreshPassword();
         }
      } else {
         $scope.oldPassword = $scope.group.sPassword;
         $scope.group.sPassword = null;
         $scope.saveGroup();
      }
   }

   $scope.refreshPassword = function(callback) {
      $scope.group.sPassword = $scope.generatePassword();
      $scope.saveGroup();
   };

   $scope.addAdminGroups = function(groups) {
      $http.post('/groupAdmin/api.php', {action: 'addAdmins', idGroup: $scope.groupId, aAdminGroups: groups}, {responseType: 'json'}).success(function(postRes) {
         $scope.formValues.adminLogins = '';
         if (!postRes || !postRes.success) {
            console.error("got error from admin groupAdmin/api.php: "+postRes.error);
         } else {
            SyncQueue.planToSend(0);
         }
         $scope.adminLoading = false;
      })
      .error(function() {
         console.error("error calling groupAdmin/api.php");
      });
   };

   $scope.saveGroup = function() {
      console.error('saveGroup');
      ModelsManager.updated('groups', $scope.groupId);
   };

   $scope.deleteGroup = function() {
      if (window.confirm("Êtes-vous certain de vouloir supprimer le groupe "+$scope.group.sName+' ? Cette opération est irréversible.')) { 
         $http.post('/groupAdmin/api.php', {action: 'deleteGroup', idGroup: $scope.groupId}, {responseType: 'json'}).success(function(postRes) {
            if (!postRes || !postRes.success) {
               console.error("got error from admin groupAdmin/api.php: "+postRes.error);
            } else {
               // deleting on the js side due to limitations of the requestSet deletion algorithm
               angular.forEach($scope.group.parents, function(parent) {
                  ModelsManager.deleted('groups_groups', parent.ID);   
               });
               ModelsManager.deleted('groups', $scope.group.ID);
               SyncQueue.planToSend(0);
               $state.go('groupAdmin');
            }
         })
         .error(function() {
            console.error("error calling groupAdmin/api.php");
         });
      }
   };

   $scope.removeUser = function(group_group, $event) {
      if ($event) {
         $event.stopPropagation();
      }
      group_group.sType = 'removed';
      ModelsManager.updated('groups_groups', group_group.ID);
   };

   $scope.removeAdmin = function(group_group) {
      $scope.adminLoading = true;
      $http.post('/groupAdmin/api.php', {action: 'removeAdmin', idGroup: $scope.groupId, idGroupAdmin: group_group.idGroupParent}, {responseType: 'json'}).success(function(postRes) {
         if (!postRes || !postRes.success) {
            console.error("got error from admin groupAdmin/api.php: "+postRes.error);
         } else {
            // this synchro is very hazardous but seems to work...
            SyncQueue.planToSend(0);
            $scope.adminLoading = false;
         }
      })
      .error(function() {
         console.error("error calling groupAdmin/api.php");
      }); 
   };

   $scope.changeAdminRole = function(group_group, sRole) {
      $http.post('/groupAdmin/api.php', {action: 'changeAdminRole', idGroup: $scope.groupId, idGroupAdmin: group_group.idGroupParent, sRole: sRole}, {responseType: 'json'}).success(function(postRes) {
         if (!postRes || !postRes.success) {
            console.error("got error from admin groupAdmin/api.php: "+postRes.error);
         } else {
            group_group.sRole = sRole;
         }
      })
      .error(function() {
         console.error("error calling groupAdmin/api.php");
      }); 
   };

   $scope.startSync = function(groupId, itemId, callback) {
      SyncQueue.requestSets.groupAdmin = {name: "groupAdmin", groupId: groupId, itemId: itemId, minVersion: 0};
      // yeah...
      SyncQueue.addSyncEndListeners('groupAdminController', function() {
         $scope.loading = false;
         SyncQueue.removeSyncEndListeners('groupAdminController');
         delete(SyncQueue.requestSets.groupAdmin.minVersion);
         callback();
         $rootScope.$broadcast('algorea.groupSynced');
      }, false, true);
      SyncQueue.planToSend(0);
   };

   $scope.initGroup = function() {
      $scope.group = ModelsManager.getRecord('groups', $scope.groupId);
      if (!$scope.group) {
         console.error('big problem!');
         return;
      }
      if ($scope.group.sPassword) {
         $scope.formValues.hasPassword = true;
      }
      $scope.usersSelected = {};
      $scope.groupsSelected = {};
      $scope.groupChildren = [];
      angular.forEach($scope.group.children, function(child_group_group) {
         var child_group = child_group_group.child;
         $scope.groupsSelected[child_group.ID] = true;
         var user = child_group.userSelf;
         if (!user) return;
         $scope.usersSelected[user.ID] = true;
         $scope.groupChildren.push(child_group_group);
      });
      $scope.adminOnGroup = false;
      angular.forEach($scope.group.parents, function(parent_group_group) {
         var parent = parent_group_group.parent;
         if (parent.ID == SyncQueue.requests.loginData.idGroupOwned) {
            if (parent_group_group.sRole == 'manager' || parent_group_group.sRole == 'owner') {
               $scope.adminOnGroup = true;
            }
            return false;
         }
      });
   };

   $scope.getUserItem = function(group_group, item) {
      var group = group_group.child;
      if (!group.userSelf) {
         console.error('group '+group.ID+' is not an user!');
         return;
      }
      var userId = group.userSelf.ID;
      var userItem = itemService.getUserItem(item, userId);
      return userItem;
   }

   $scope.toggleUserRowSelection = function(group) {
      $scope.groupsSelected[group.ID] = !$scope.groupsSelected[group.ID];
      var user = group.userSelf;
      if (!user) return;
      $scope.usersSelected[user.ID] = !$scope.usersSelected[user.ID];
      $scope.updateEvents();
   }

   $scope.userClickedInMembers = function(group) {
      angular.forEach($scope.groupsSelected, function(val, ID) {
         $scope.groupsSelected[ID] = false;
      });
      $scope.groupsSelected[group.ID] = true;
      var user = group.userSelf;
      if (!user) return;
      angular.forEach($scope.usersSelected, function(val, ID) {
         $scope.usersSelected[ID] = false;
      });
      $scope.usersSelected[user.ID] = true;
      $scope.updateEvents();
      $scope.formValues.activeTab = 2; // selects members tab
   }

   function fillItemsListWithSonsRec(itemsList, itemsListRev, item) {
      if (!item) return;
      angular.forEach(item.children, function(child_item_item) {
         var child_item = child_item_item.child;
         if (child_item.sType != 'Course' && child_item.sType != 'Presentation') {
            itemsList.push(child_item);
            itemsListRev[child_item.ID] = true;
         }
         if (child_item.children) {
            fillItemsListWithSonsRec(itemsList, itemsListRev, child_item)
         }
      });
   }

   $scope.selectedItemId = 0;
   $scope.dropdownSelections = [];

   $scope.dropdownSelected = function(depth) {
      if (depth === 0) { // final dropdown
         depth = $scope.dropdownSelections.length;
      }
      var itemId = $scope.dropdownSelectionsIDs[depth];
      if (itemId == 0) {
         depth=depth-1;
         itemId = $scope.dropdownSelections[depth].ID;
      }
      var newSelections = [];
      var newSelectionsIDs = [];
      for (var i = 0; i < depth; i++) {
         newSelections[i] = $scope.dropdownSelections[i];
         newSelectionsIDs[i] = $scope.dropdownSelections[i].ID;
      }
      var newRootItem = ModelsManager.getRecord('items', itemId);
      newSelections[depth] = newRootItem;
      newSelectionsIDs[depth] = newRootItem.ID;
      $scope.dropdownSelections = newSelections;
      $scope.dropdownSelectionsIDs = newSelectionsIDs;
      $scope.itemSelected(newRootItem);
   }

   $scope.itemSelected = function(item) {
      if ($scope.rootItem == item) return;
      $scope.rootItem = item;
      $scope.itemsList = [item];
      $scope.itemsListRev = {};
      fillItemsListWithSonsRec($scope.itemsList, $scope.itemsListRev, $scope.rootItem);
      $scope.startSync($scope.groupId, item.ID, function() {
         $scope.initItems();
         $scope.initGroup();
         SyncQueue.addSyncEndListeners('groupAdminUsersItems', function() {
            if (needToUpdateAtEndOfSync) {
               $scope.updateEvents();
               needToUpdateAtEndOfSync = false;
            }
            if (needToUpdateGroupsGroupsAtEndOfSync) {
               $scope.updateGroupsGroups();
               needToUpdateGroupsGroupsAtEndOfSync = false;
            }
         });
         $scope.updateEvents();
      });
   }

   $scope.levelSelected = function() {
      $scope.itemSelected($scope.formValues.selectedLevel);
      $scope.dropdownSelections = [];
      $scope.dropdownSelectionsIDs = [];
      $scope.dropdownSelections[0] = $scope.formValues.selectedLevel;
      $scope.dropdownSelectionsIDs[0] = $scope.formValues.selectedLevel.ID;
   }

   $scope.initItems = function() {
      var officialRootItem = ModelsManager.getRecord('items', config.domains.current.OfficialProgressItemId);
      var customRootItem = ModelsManager.getRecord('items', config.domains.current.CustomProgressItemId);
      $scope.levels = [];
      angular.forEach(officialRootItem.children, function(child) {
         $scope.levels.push(child.child);
      });
      angular.forEach(customRootItem.children, function(child) {
         $scope.levels.push(child.child);
      });
      if (!$scope.formValues.selectedLevel) {
         $scope.formValues.selectedLevel = $scope.levels[0];
         $scope.levelSelected($scope.levels[0].ID);
      }
   };

   $scope.stopSync = function() {
      delete(SyncQueue.requestSets.groupAdmin);
      SyncQueue.removeSyncEndListeners('groupAdminUsersItems');
      ModelsManager.removeListener('users_items', 'deleted', 'groupAdminDeleted');
      ModelsManager.removeListener('users_items', 'inserted', 'groupAdminInserted');
      ModelsManager.removeListener('users_items', 'updated', 'groupAdminUpdated');
      ModelsManager.removeListener('groups_groups', 'deleted', 'groupAdminGpsGpsDeleted');
      ModelsManager.removeListener('groups_groups', 'inserted', 'groupAdminGpsGpsInserted');
      ModelsManager.removeListener('groups_groups', 'updated', 'groupAdminGpsGpsUpdated');
   };

   $scope.allUserItems = ModelsManager.curData.users_items;

   // not used, maybe later
   $scope.newGroup = function (callback) {
      if (!SyncQueue.requests.loginData || SyncQueue.requests.loginData.tempUser) {
         $scope.error = 'Vous ne pouvez créer des groupes qu\'en était connecté';
         return;
      }
      $scope.group = ModelsManager.createRecord('groups');
      $scope.group.idUser = SyncQueue.requests.loginData.ID;
      $scope.group.sDateCreated = new Date();
      $scope.groupId = $scope.group.ID;
      $scope.group.sName = 'Noueau groupe';
      $http.post('/groupAdmin/api.php', {action: 'createGroup', idGroup: $scope.groupId}, {responseType: 'json'}).success(function(postRes) {
         if (!postRes || !postRes.success) {
            console.error("got error from admin groupAdmin/api.php: "+postRes.error);
         } else {
            $state.go('groupAdminGroup', {idGroup: $scope.group.ID}).then(function(){$stateParams.idGroup = $scope.group.ID;});
         }
      })
      .error(function() {
         console.error("error calling groupAdmin/api.php");
      }); 
   };

   $scope.init = function() {
      $scope.loading = true;
      $scope.progressionType = 'chronological';
      $scope.groupId = $stateParams.idGroup;
      $scope.error = '';
      $scope.adminInvitationError = null;
      $scope.invitationError = null;
      if (SyncQueue.requests.loginData.tempUser == 1) {
         //$scope.error = 'Vous devez être connecté pour accéder à cette interface.';
         //$scope.loading = false;
         //return;
      }
      if (!$scope.groupId || $scope.groupId == 'new') {
         $scope.newGroup();
         return;
      }
      $scope.startSync($scope.groupId, $scope.itemId, function() {
         $scope.initItems();
         $scope.initGroup();
         SyncQueue.addSyncEndListeners('groupAdminUsersItems', function() {
            if (needToUpdateAtEndOfSync) {
               $scope.updateEvents();
               needToUpdateAtEndOfSync = false;
            }
            if (needToUpdateGroupsGroupsAtEndOfSync) {
               $scope.updateGroupsGroups();
               needToUpdateGroupsGroupsAtEndOfSync = false;
            }
         });
      });
   };

   $scope.$on('$destroy', function() {
      $scope.stopSync();
   });
   
   $scope.loading = true;
   itemService.onNewLoad($scope.init);

}]);