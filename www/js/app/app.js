define(['ChUI'], function ($) {
    "use strict";

    var _me, _currentProfile = {};
    var _loadedProfiles = [];
    var _url = 'http://agerestapi.azurewebsites.net';
    var _urlDev = 'http://192.168.11.112:1337';
    var _urlProd = 'http://agerestapi.azurewebsites.net';
    var _isConfirmOpen, _isAlertOpen, _isBusyOpen = false;
    var $registerFriendView, $meView, $editMeView, $profileListView, $profileListTemplate, $profileView, $popupPanel, 
        $popup;
    var _clearImageData = "data:image/svg+xml;utf8,%3Csvg%20version%3D%221.1%22%20id%3D%22Capa_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20x%3D%220px%22%20y%3D%220px%22%0A%09%20width%3D%2218.889px%22%20height%3D%2223.316px%22%20viewBox%3D%220%200%2018.889%2023.316%22%20enable-background%3D%22new%200%200%2018.889%2023.316%22%20xml%3Aspace%3D%22preserve%22%3E%0A%3Ccircle%20style%3D%22fill%3A%23002FFF%3B%22%20cx%3D%226.408%22%20cy%3D%224.729%22%20r%3D%224.729%22%2F%3E%0A%3Cpath%20style%3D%22fill%3A%23002FFF%3B%22%20d%3D%22M13.29%2C12.121c-0.614%2C0-1.203%2C0.104-1.757%2C0.287c-1.169-1.499-3.026-2.472-5.125-2.472C2.868%2C9.937%2C0%2C12.693%2C0%2C16.097v3.421%0A%09h7.994c0.752%2C2.206%2C2.84%2C3.8%2C5.296%2C3.8c3.088%2C0%2C5.599-2.512%2C5.599-5.599S16.378%2C12.121%2C13.29%2C12.121z%20M8.926%2C17.719%0A%09c0-2.406%2C1.958-4.365%2C4.364-4.365c2.408%2C0%2C4.366%2C1.959%2C4.366%2C4.365c0%2C2.407-1.958%2C4.365-4.366%2C4.365%0A%09C10.884%2C22.084%2C8.926%2C20.126%2C8.926%2C17.719z%22%2F%3E%0A%3Cpath%20style%3D%22fill%3A%23002FFF%3B%22%20d%3D%22M14.069%2C14.509h-1.39c-0.001%2C0.666%2C0%2C2.418%2C0%2C2.418s-1.508%2C0-2.254%2C0.002v1.389c0.746-0.001%2C2.254-0.001%2C2.254-0.001%0A%09s0%2C1.75-0.001%2C2.419h1.39c0.001-0.669%2C0.001-2.419%2C0.001-2.419s1.507%2C0%2C2.253%2C0v-1.39c-0.746%2C0-2.253%2C0-2.253%2C0%0A%09S14.068%2C15.175%2C14.069%2C14.509z%22%2F%3E%0A%3C%2Fsvg%3E";

    //#region Common

    //levels: {
    //        trace: 0,
    //        debug: 1,
    //        info: 2,
    //        warn: 3,
    //        crit: 4,
    //        fatal: 5
    //}
    function log(type, message, metadata) {
        var payload = {
            'type': type,
            'message': message
        };
        if (metadata)
            payload.metadata = metadata;

        setTimeout(function() {
            $.ajax({
                type: "POST",
                url: _url + '/logs',
                data: payload,
                dataType: 'json',
                success: $.noop,
                error: $.noop,
                timeout: 5000
        });
        }, 600);
    }

    function showAlert(title, message) {
        _isAlertOpen = true;
        closeBusy();
        navigator.notification.alert(
                        message,
                        function () { _isAlertOpen = false; },
                        title,
                        'OK'// buttonName
                    );
    }

    function confirmAction(title, message, callback) {
        _isConfirmOpen = true;
        closeBusy();
         navigator.notification.confirm(
            message,
            function(buttonIndex) {
                _isConfirmOpen = false;
                callback(buttonIndex === 1);
            },
            title,
            ['Yes', 'No']// buttonNames
         );
    }

    function handleError(event, info) {
        try {
            var error = JSON.parse(event.responseText);
            showAlert('Error', error.message);
        } catch (e) {
            var meta = {
                'session': localStorage.getItem('sessionid'),
                'device': navigator.userAgent,
                'userid': _me ? _me._id : 'unKnown',
                'info': info
            };
            if (event.status) {
                showAlert('Error', event.status + ': ' + event.responseText);
                log('crit', 'app error: status=' + event.status + ' text=' + event.responseText, meta);
            }
            else {
                showAlert('Error', 'Unexpected error. Please try again.');
                log('crit', 'app error: no data', meta);
            }
        } 
        
    }

    function setUp(sessionId) {
        $.ajaxSetup({
            headers: {
                'x-session': sessionId
            },
            timeout: 20000,
            error: function (event) {
                closeBusy();
                if (event.status === 403 || event.status === 401) {
                    localStorage.removeItem('sessionid');
                    navigator.notification.alert(
                        'Sorry, your session has expired. Logging you in using facebook.',  // message
                        function () { loadMe(); },         // callback
                        'Session expired',            // title
                        'OK'                  // buttonName
                    );
                    log('debug', status + ' for: ' + sessionId + ' user:' + _me._id);
                }
                else {
                    handleError(event);
                }
            }
        });

        localStorage.setItem('sessionid', sessionId);
        //var dataToStore = JSON.stringify(data);
    }

    function firstView() {
        $.UIGoToArticle("#" + $('article').eq(0).attr('id'));
        $.UINavigationHistory = ["#" + $('article').eq(0).attr('id')];
    }

    function showBusy() {
        _isBusyOpen = true;
        window.plugins.spinnerDialog.show(null, "Loading");

        setTimeout(function () {
            closeBusy();
        }, 20000);
    }

    function closeBusy() {
        window.plugins.spinnerDialog.hide();
        _isBusyOpen = false;
    }

    function setAllViewVars() {
        var $body = $('body');
        $meView = $body.find('#meview');
        $registerFriendView = $body.find('#registerfriend');
        $editMeView = $body.find('#editmeview');
        $profileListView = $body.find('#profilelist');
        $profileListTemplate = $body.find('#profileTemplate');
        $profileView = $body.find('#viewprofile');
        $popupPanel = $body.find('.popup .panel');
        $popup = $body.find('.popup');

    }

    function registerGlobalEvents() {
        $.subscribe('backbuttonhit', function () {
            if (_isBusyOpen || _isAlertOpen || _isConfirmOpen || $('.slide-out.open').length > 0) //or sheet open
                return;
            if ($.UINavigationHistory.length > 1)
                $.UIGoBack();
            else
                confirmAction('Exit', 'Are you sure you want to exit the app?', function(confirmed) {
                    if(confirmed) navigator.app.exitApp();
                });
        });
    }

    function registerOnArticleLeaveCleanUp() {
        
        var callback = function (topic, view) {
            setTimeout(function () {
                
                switch (view) {
                    case 'registerfriend':
                        $registerFriendView.find(':input').val('');
                        $registerFriendView.find('#friendImage').off().attr('src', _clearImageData);
                        $registerFriendView.find(':button').off().hide();
                        $registerFriendView.find('#agreeToTerms').prop('checked', false);
                        $registerFriendView.find('#agreeToTermsUl').hide();
                        break;
                    case 'editmeview':
                        $editMeView.find(':input').val('');
                        $editMeView.find(':button').off();
                        $editMeView.find('#editmeImage').off().attr('src', _clearImageData);
                        break;
                    case 'viewprofile':
                        $profileView.find(':button').off().hide();
                        $profileView.find('img').attr('src', _clearImageData);
                        $profileView.find(':header, p').text('');
                        break;
                    case 'profilelist':
                        $profileListView.find('#profilescontainer').empty();
                        break;
                    default:
                }
            }, 600);


        };

        $.subscribe('chui/navigate/leave', callback);
        $.subscribe('chui/navigateBack/leave', callback);
    }

    function registerOnArticleEnterSetup() {
        var callback = function (topic, view) {
            $('#smenuEdit, #smenuDelete, #smenuRefresh, #smenuRegisterFriend').hide();
            switch (view) {

                case 'editmeview':
                    editMe();
                break;
                case 'viewprofile':
                    $('#smenuEdit, #smenuDelete').show();
                    loadProfile();
                break;
                case 'profilelist':
                    $('#smenuRefresh, #smenuRegisterFriend').show();
                    listProfiles();
                break;
                case 'meview':
                    $('#smenuEdit').show();
                    break;
            default:
            }
        };
        $.subscribe('chui/navigate/enter', callback);
        $.subscribe('chui/navigateBack/enter', callback);

    }

    function addSlideOut() {
        //$('body').addClass('slide-out-app');
        $('.menu-button').on('singletap', function () {
            $('.slide-out').toggleClass('open');
        });
        $('.slide-out').removeClass('open');

        $('#menuEdit').on('singletap', function () {
            $('.slide-out').toggleClass('open');
            if ($('article.current')[0].id === 'meview')
                $.UIGoToArticle('#' + $editMeView[0].id);
            else editFriend();
        });

        $('#menuDeviceInfo').on('singletap', function () {
            $('.slide-out').toggleClass('open');
            showAlert('Device Info', navigator.userAgent);
        });
        $('#menuUseDev').on('singletap', function () {
            $('.slide-out').toggleClass('open');
            _url = (_url == _urlDev) ? _urlProd : _urlDev;
            showAlert('URL', _url);
        });
        $('#menuLogs').on('singletap', function () {
            $('.slide-out').toggleClass('open');
            logs();
        });
        $('#menuRegisterFriend').on('singletap', function () {
            $('.slide-out').toggleClass('open');
            registerFriend();
        });
        $('#menuViewFriends').on('singletap', function () {
            $('.slide-out').toggleClass('open');
            loadAllFriends();
        });
        $('#menuExit').on('singletap', function () {
            $('.slide-out').toggleClass('open');
            navigator.app.exitApp();
        });
    }

    function addSheet() {
        $.UISheet({ id: "menuSheet" });
        var templ = $('#sheetTemplate').text();
        $('.sheet').find('section').append(templ);
        $('.sheet > .handle').on('singletap', 'button', function () {
            $.UIHideSheet();
        });
        $('#smenuEdit').on('singletap', function () {
            $.UIHideSheet();
            if ($('article.current')[0].id === 'meview')
                $.UIGoToArticle('#' + $editMeView[0].id);
            else editFriend();

        });
        $('#smenuRefresh').on('singletap', function () {
            $.UIHideSheet();
            if ($('article.current')[0].id === 'profilelist') {
                _loadedProfiles = [];
                loadAllFriends();
            }
        });
        $('#smenuRegisterFriend').on('singletap', function () {
            $.UIHideSheet();
            if ($('article.current')[0].id === 'profilelist') {
                registerFriend();
            }
        });
        $('#smenuDelete').on('singletap', function () {
            $.UIHideSheet();
            if ($('article.current')[0].id === 'viewprofile') {
                deleteFriend();
            }
        });
        $('#meSMenu, #profileSMenu, #profilelistSMenu').on('singletap', function () {
            $.UIShowSheet("#menuSheet");
        });

    }

    function getPicture(callback) {
        navigator.camera.getPicture(function (imageData) {
            callback(null, "data:image/jpeg;base64," + imageData);
        }, function (errorMessage) {
            if (errorMessage == 'Selection Cancelled.')
                return;
            callback(errorMessage);
            showAlert('Picture add failed', errorMessage);
        }, {
            quality: 75,
            destinationType: Camera.DestinationType.DATA_URL,
            correctOrientation: true,
            sourceType: Camera.PictureSourceType.PHOTOLIBRARY
        });
    }

    function findById(id) {
        var found = $.grep(_loadedProfiles, function (o) {
            return o._id === id;
        });
        if (found) return found[0];
        return null;
    }

    function updateById(update) {
        var allButId = $.grep(_loadedProfiles, function (o) {
            return o._id !== update._id;
        });
        if (allButId && allButId.length === (_loadedProfiles.length - 1)) {
            _loadedProfiles = allButId;
            _loadedProfiles.unshift(update);
        }
    }

    function deleteById(id) {
        var allButId = $.grep(_loadedProfiles, function (o) {
            return o._id !== id;
        });
        if (allButId && allButId.length === (_loadedProfiles.length - 1)) {
            _loadedProfiles = allButId;
        }
    }

    //#endregion

    //#region Friend

    function confirmDelete(name, callback) {
        navigator.notification.confirm(
            'Are you sure you want to delete ' + name + '?',
            function (buttonIndex) { callback(buttonIndex === 1); },
            'Confirm',            // title
            ['Yes', 'No']              // buttonNames
            );
    }

    function deleteFriend() {
        confirmDelete(_currentProfile.name, function (confirmed) {
            if (!confirmed) return;
            showBusy();
            $.ajax({
                url: _url + '/friends/' + _currentProfile._id,
                type: 'DELETE',
                success: function () {
                    deleteById(_currentProfile._id);
                    closeBusy();
                    $.UIGoBackToArticle('#' + $profileListView[0].id);
                }
            });
        });
    }

    function editFriend() {
        $registerFriendView.find('#friendImage').on('singletap', function () {
            getPicture(function (err, image) {
                if (err) return;
                $registerFriendView.find('#friendImage').attr('src', image);
            });
        });
        $('#registerFriendHeader').text('Edit Friend');
        $registerFriendView.find('#friendImage').attr('src', _currentProfile.picture);
        $registerFriendView.find('#friendName').val(_currentProfile.name);
        $registerFriendView.find('#friendAge').val(_currentProfile.age);
        $registerFriendView.find('#friendCity').val(_currentProfile.location);
        $registerFriendView.find('#friendEmail').val(_currentProfile.email);


        if ($.isArray(_currentProfile.profile) && _currentProfile.profile.length > 0) {
            $registerFriendView.find('#friendLikes').val('Likes: ' + _currentProfile.profile[0].likes);
            $registerFriendView.find('#friendDescription').val(_currentProfile.profile[0].description);
        }

        $.UIGoToArticle('#' + $registerFriendView[0].id);

        $registerFriendView.find('#saveFriendEdit').show().on('singletap', { id: _currentProfile._id }, function (event) {
            showBusy();
            var friend = {};
            friend._id = event.data.id;
            friend.name = $registerFriendView.find('#friendName').val();
            friend.age = $registerFriendView.find('#friendAge').val();
            friend.location = $registerFriendView.find('#friendCity').val();
            friend.email = $registerFriendView.find('#friendEmail').val();
            friend.picture = $registerFriendView.find('#friendImage').attr('src');

            var profile = {
                description: $registerFriendView.find('#friendDescription').val(),
                likes: $registerFriendView.find('#friendLikes').val(),
                createdBy: _currentProfile.profile[0].createdBy
        };
            friend.profile = [profile];

            $.ajax({
                type: "PUT",
                url: _url + '/friends/' + friend._id,
                data: friend,
                dataType: 'json',
                success: function() {
                    _currentProfile = friend;
                    $.UIGoBack();
                    updateById(friend);
                    closeBusy();
                }
            });
        });
    }

    function confirmRegister(name, callback) {
        navigator.notification.confirm(
            'Are you sure you want to register ' + name + '?',
            function (buttonIndex) { callback(buttonIndex === 1); },
            'Confirm',            // title
            ['Yes', 'No']              // buttonNames
            );
    }

    function loadAllFriends() {
        if (_loadedProfiles.length > 0)
            $.UIGoToArticle('#' + $profileListView[0].id);
        else {
            showBusy();
            $.ajax({
                url: _url + '/friends',
                dataType: 'json',
                type: 'GET'
            }).done(function(data) {
                if ($.isArray(data) && data.length > 0) {
                    _loadedProfiles = data;
                    if ($('article.current')[0].id === 'profilelist')
                        listProfiles();
                    else
                        $.UIGoToArticle('#' + $profileListView[0].id);
                    closeBusy();
                }
                else {
                    closeBusy();
                    navigator.notification.confirm(
                        'You have not registered any friends. Would you like to register one?',
                        function(buttonIndex) {
                            if (buttonIndex === 1)
                                registerFriend();
                        },
                        'No Friends', // title
                        ['Yes', 'No'] // buttonNames
                    );
                }
            });
        }
    }

    function registerFriend() {
        $registerFriendView.find('#friendImage').on('singletap', function () {
            getPicture(function (err, image) {
                if (err) return;
                $registerFriendView.find('#friendImage').attr('src', image);
            });
        });

        $('#registerFriendHeader').text('Register Friend');
        $registerFriendView.find('#submitRegistration, #agreeToTermsUl').show();
        $.UIGoToArticle('#' + $registerFriendView[0].id);

        $registerFriendView.find('#submitRegistration').on('singletap', function () {
            if ($registerFriendView.find('#agreeToTerms').prop('checked') === false) {
                showAlert('Terms', 'Please agree to terms to register friend');
                return;
            }

            var friend = {};
            friend.name = $registerFriendView.find('#friendName').val();
            friend.age = $registerFriendView.find('#friendAge').val();
            friend.location = $registerFriendView.find('#friendCity').val();
            friend.email = $registerFriendView.find('#friendEmail').val();
            friend.picture = $registerFriendView.find('#friendImage').attr('src');

            var profile = {
                description: $registerFriendView.find('#friendDescription').val(),
                likes: $registerFriendView.find('#friendLikes').val(),
                status: 'registered'
            };
            friend.profile = [profile];

            confirmRegister(friend.name, function (confirmed) {
                if (!confirmed) {
                    return;
                } else {
                    showBusy();

                    $.ajax({
                        type: "POST",
                        url: _url + '/friends',
                        data: friend,
                        dataType: 'json',
                        success: function (registeredFriend) {
                            registeredFriend.profile[0].createdBy = _me;
                            _loadedProfiles.unshift(registeredFriend);
                            closeBusy();
                            $.UIGoBack();
                        }
                    });

                }

            });

        });
    }

    //#endregion

    //#region Logs

    function logs() {
        showBusy();
        var template = $('#logsTemplate').text();
        var logsTemplate = $.template(template);
        var $list = $('#logscontainer');
        $list.empty();

        $.ajax({
            type: "GET",
            url: _url + '/logs',
            dataType: 'json',
            success: function (data) {
                if (data && data.length > 0) {
                    data.forEach(function (d) {
                        $list.append(logsTemplate(d));
                    });
                    $.UIGoToArticle('#logs');
                    closeBusy();
                }
            }
        });

    }

    //#endregion

    //#region Profile

    function listProfiles() {
        if (_loadedProfiles == null || !$.isArray(_loadedProfiles))
            return;

        var template = $profileListTemplate.text();
        var profileTemplate = $.template(template);
        var $list = $profileListView.find('#profilescontainer');
        $list.empty();
        _loadedProfiles.forEach(function (profile) {
            $list.append(profileTemplate(profile));
        });

        $list.children().on('singletap', function (event) {
            var id = $(event.target).closest('li').attr('id');
            var profile = findById(id);
            _currentProfile = profile;
            $.UIGoToArticle('#' + $profileView[0].id);
        });
    }

    function loadProfile() {
        $profileView.find('#registeredByLabel').text('Registered By');
        $profileView.find('#profileName').text(_currentProfile.name);
        $profileView.find('#profileAge').text('Age: ' + _currentProfile.age);
        $profileView.find('#profileCity').text('Location: ' + _currentProfile.location);
        $profileView.find('#profileImage').attr('src', _currentProfile.picture).on('singletap', { image: _currentProfile.picture, name: _currentProfile.name }, function (event) {
            $('#pictureviewPicture').attr('src', event.data.image).panzoom();
            $('#pictureviewHeader').text(event.data.name);
            $.UIGoToArticle('#pictureview');
        });

        if ($.isArray(_currentProfile.profile) && _currentProfile.profile.length > 0) {
            $profileView.find('#profileLikes').text('Likes: ' + _currentProfile.profile[0].likes);
            $profileView.find('#profileDescription').text(_currentProfile.profile[0].description);
        }

        var createdBy = _currentProfile.profile[0];
        createdBy = createdBy ? createdBy.createdBy : null;
        if (createdBy) {

            $profileView.find('#profileMeName').text(createdBy.name);
            $profileView.find('#profileMeAge').text('Age: ' + createdBy.age);
            $profileView.find('#profileMeCity').text('City: ' + createdBy.location);
            $profileView.find('#profileMeDescription').text(createdBy.description);
            $profileView.find('#profileMeGender').text('Gender: ' + createdBy.gender);
            $profileView.find('#profileMeImage').attr('src', createdBy.picture).on('singletap', { image: createdBy.picture, name: createdBy.name }, function (event) {
                $('#pictureviewPicture').attr('src', event.data.image).panzoom();
                $('#pictureviewHeader').text(event.data.name);
                $.UIGoToArticle('#pictureview');
            });

            if (createdBy._id === _me._id) {
                $profileView.find('#profileEmail').text('Email: ' + _currentProfile.email).parent().show();
            }

        }

    }



    //#endregion

    //#region Me

    function facebookLogin(callback) {
        facebookConnectPlugin.login(['public_profile', 'user_birthday', 'user_relationship_details', 'user_location', 'user_relationships', 'user_photos', 'email'],
            function (data) {
                var token = data.authResponse.accessToken;
                callback(token);
            },
            function (err) { alert("Could not get access token: " + err) }
        );
    }

    function editMe() {
        $editMeView.find('#editmeImage').on('singletap', function () {
            getPicture(function (err, image) {
                if (err) return;
                $editMeView.find('#editmeImage').attr('src', image);
            });
        });
        $editMeView.find('#editmeImage').attr('src', _me.picture);
        $editMeView.find('#editmeName').val(_me.name);
        $editMeView.find('#editmeAge').val(_me.age);
        $editMeView.find('#editmeCity').val(_me.location);
        $editMeView.find('#editmeEmail').val(_me.email);
        $editMeView.find('#editmeDescription').val(_me.description);


        $editMeView.find('#editmeSave').on('singletap', function () {
            showBusy();
            _me.name = $editMeView.find('#editmeName').val();
            _me.age = $editMeView.find('#editmeAge').val();
            _me.location = $editMeView.find('#editmeCity').val();
            _me.email = $editMeView.find('#editmeEmail').val();
            _me.description = $editMeView.find('#editmeDescription').val(),
                _me.picture = $editMeView.find('#editmeImage').attr('src');

            $.ajax({
                type: "PUT",
                url: _url + '/users',
                data: _me,
                dataType: 'json',
                success: function () {
                    loadMeView();
                    $.UIGoBack();
                    closeBusy();
                }
            });
        });

        $.UIGoToArticle('#' + $editMeView[0].id);
    }

    function loadMeView() {
        $meView.find('#meName').text(_me.name);
        $meView.find('#meAge').text('Age: ' + _me.age);
        $meView.find('#meGender').text('Gender: ' + _me.gender);
        $meView.find('#meDesc').text(_me.description);
        $meView.find('#meImage').attr('src', _me.picture).on('singletap', {image: _me.picture, name: _me.name},function(event) {
            $('#pictureviewPicture').attr('src', event.data.image).panzoom();
            $('#pictureviewHeader').text(event.data.name);
            $.UIGoToArticle('#pictureview');
        });
       
    }

    function loadMe() {
        var session = localStorage.getItem('sessionid');
        if (session) {
            showBusy();
            $.ajax({
                dataType: "json",
                url: _url + '/users',
                headers: { 'x-session': session },
                success: function (data, status, xhr) {
                    _me = data;
                    setUp(xhr.getResponseHeader('x-session'));
                    loadMeView();
                    closeBusy();
                    log('info', 'Loaded user using session: ' + session + ' : ' + _me._id + ' Name: ' + _me.name);
                },
                error: function (event) {
                    localStorage.removeItem('sessionid');
                    handleError(event, 'session auth get /users using session ' + session);
                }
            });
        } else {
            facebookLogin(function (accessToken) {
                showBusy();
                $.ajax({
                    dataType: "json",
                    url: _url + '/users',
                    headers: { 'access_token': accessToken },
                    success: function (data, status, xhr) {
                        _me = data;
                        setUp(xhr.getResponseHeader('x-session'));
                        loadMeView();
                        closeBusy();
                        log('info', 'Loaded user using facebook: ' + accessToken + ' : ' + _me._id + ' Name: ' + _me.name);
                    },
                    error: function(event) {
                        handleError(event, 'facebook auth get /users with token ' + accessToken);
                    }
                });
            });
        }
    }

    //#endregion

    return {
        init: function () {
            setAllViewVars();
            registerGlobalEvents();
            registerOnArticleLeaveCleanUp();
            registerOnArticleEnterSetup();
            addSlideOut();
            addSheet();
            loadMe();
        }
    }
});