// pnpPeople()
// This is the constructor for the Google People API service object. It handles all the actual API
// interactions and surfaces properties and methods for the UI to access and manipulate that information.
// When this object is instantiated, it automatically initializes the API interface and then uses that
// interface to acquire the initial user and contact info for the UI to display.
function pnpPeople() {

	// Public properties of the object
	this.userName = ""; // user name the API interface is set to
	this.userEmail = ""; // email for the current user
	this.userAddress = ""; // address of the current user
	this.userContacts = []; // array of userContact objects for the current user

	this.apiAvailable = false; // indicates whether the api interface is ready to use
	this.apiStatus = -1; // TODO use this to indicate status of last api operation
	this.apiMessage = ""; // TODO use this to contain any msg from last api operation

	// Private object variables
	// Following values are the keys and other data needed to access the Google People API
	// Enter an API key from the Google API Console:
	//   https://console.developers.google.com/apis/credentials
	var apiKey = 'AIzaSyCeX4km95QWqdGNVmUyViVokHeGtgKEdJc';
	// Enter the API Discovery Docs that describes the APIs you want to
	// access. In this example, we are accessing the People API, so we load
	// Discovery Doc found here: https://developers.google.com/people/api/rest/
	var discoveryDocs = ["https://people.googleapis.com/$discovery/rest?version=v1"];
	// Enter a client ID for a web application from the Google API Console:
	//   https://console.developers.google.com/apis/credentials?project=_
	// In your API Console project, add a JavaScript origin that corresponds
	//   to the domain where you will be running the script.
	var clientId = '81635511272-3aqree7eknd8g7jdb905gcn9pvesjgg6.apps.googleusercontent.com';
	// Enter one or more authorization scopes. Refer to the documentation for
	// the API or https://developers.google.com/people/v1/how-tos/authorizing
	// for details.
	var scopes = 'https://www.googleapis.com/auth/contacts.readonly';

	// The API object for the current signed-in google user
	var curGoogleUser;

	// Public methods of the object
	// TODO implement any API methods needed beyond accessing the initial data
	// TODO not sure if there will be any at this time

	// Private functions for the object

	// initUserData()
	// Begins the process of initializing the API interface and accessing the initial data
	// after the Google API javascript library has completed loading
	function initUserData() {

		// wait until the gapi javascript has finished loading before proceeding
		var cntRetry = 0;
        while (!gapiScriptLoaded) {
        	// TODO something is seriously wrong if the script hasn't loaded in 500 seconds
        	// TODO but we still probably need to write some error handling here JIC
        	// TODO or better yet replace it with a callback
			if (cntRetry++ < 1000) {
				setTimeout(initUserData, 500);
				return;
			} 
        }

        // Load the API client and auth2 library; callback to initGapiClient when done
        gapi.load('client:auth2', initGapiClient);
	}

	// initGapiClient()
	// Callback from completing the load of the Google API client and authentication modules.
	// Uses the Google API function().then() mechanism for completion callback.
	function initGapiClient() {
		// Init the gapi client with our app info
		gapi.client.init({
			apiKey: apiKey,
			discoveryDocs: discoveryDocs,
			clientId: clientId,
			scope: scopes
		}).then(function () {
			// Get the current user's google sign-in state and listen for changes to it
			gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
			// Handle the initial sign-in state and make sure the user is signed in
			updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

	    });
	}

	// getUserData()
	// After we have established proper authentication credentials with the Google People API,
	// this function accesses the data for the app user and their contact list, making it publically
	// available to other functions of the app.
	// Uses the Google API function().then() mechanism for completion callback.
	function getUserData() {

		// wait until the user has signed-in before proceeding
		var cntRetry = 0;
        while (!self.apiAvailable) {
        	// TODO if the user hasn't signed-in in 500 seconds we need to write some error handling here
        	// TODO or better yet, replace it with a callback
			if (cntRetry++ < 1000) {
				setTimeout(getUserData, 500);
				return;
			} 
		}

		// Get info for our current user
		curGoogleUser = gapi.auth2.getAuthInstance().currentUser.get();
		gapi.client.people.people.get({
			'resourceName': 'people/me',
			'requestMask.includeField': 'person.names,person.emailAddresses,person.addresses'
		}).then(function(resp) {
			var user = resp.result;
			if (user.names && user.names.length > 0) {
				self.userName = user.names[0].displayName;
			} else {
				self.userName = "";
			}
			if (user.emailAddresses && user.emailAddresses.length > 0) {
				self.userEmail = user.emailAddresses[0].value;
			} else {
				self.userEmail = "";
			}
			if (user.addresses && user.addresses.length > 0) {
				self.userAddress = user.addresses[0].formattedValue;
			} else {
				self.userAddress = "";
			}
			pushUserData(); // push the user data to the main user object
		})

		// And their contact list
		// TODO number of contacts to retrieve is set to 500 which will work for our test case
		// TODO but need to handle the case where there are more contacts than can be loaded in
		// TODO one call
        gapi.client.people.people.connections.list({
           'resourceName': 'people/me',
           'pageSize': 500,
			'requestMask.includeField': 'person.names,person.emailAddresses,person.addresses'
         }).then(function(resp) {
			var connections = resp.result.connections;

			// load the contact info into the contacts array
			self.userContacts = [];
			if (connections.length > 0) {
				for (i = 0; i < connections.length; i++) {
					var person = connections[i];
					var resID = person.resourceName;
					var name = "";
					if (person.names && person.names.length > 0) {
						name = person.names[0].displayName;
					}
					var email = "";
					if (person.emailAddresses && person.emailAddresses.length > 0) {
						email = person.emailAddresses[0].value;
					}
					var address = "";
					if (person.addresses && person.addresses.length > 0) {
						address = person.addresses[0].formattedValue;
					}
					self.userContacts.push(new pnpContact(resID, name, email, address));

				}
         
				pushContactData(); // push the contact data to the main user object

			}

         });

    }

	// pushUserData()
	// After we have accessed the data for the app user and their contact list, this function
	// pushes that data to the main user object for the app. A push is used because that is the
	// quickest way to initialize the main user object. Because this service object is initialized
	// asynchronously, the object may actually exist but not contain valid data. Thus any accesses
	// have to wait until the data is ready. A push ensures that the data will be available as soon
	// as it is ready.
    function pushUserData() {

    	user.resID = curGoogleUser.getBasicProfile().getId(); // user's unique Google resource ID
		user.name = self.userName; // the full name of the signed-in google account currently accessing the app
		user.email = self.userEmail; // the email address of the signed-in google account currently accessing the app
		user.address = self.userAddress; // the street address of the signed-in google account currently accessing the app
		user.userReady = true; // indicates whether the user object now has data loaded and is ready for use
		user.ready = (user.userReady && user.contactsReady);

		console.log(user);

    }

	// pushContactData()
	// After we have accessed the data for the app user and their contact list, this function
	// pushes that data to the main user object for the app. A push is used because that is the
	// quickest way to initialize the main user object. Because this service object is initialized
	// asynchronously, the object may actually exist but not contain valid data. Thus any accesses
	// have to wait until the data is ready. A push ensures that the data will be available as soon
	// as it is ready.
    function pushContactData() {

		user.contacts = self.userContacts; // array of the user's contact objects
		user.contactsReady = true; // indicates whether the user object now has data loaded and is ready for use
		user.ready = (user.userReady && user.contactsReady);

		console.log(user);

    }

	// updateSigninStatus(isSignedIn)
	// If we don't have an authenticated API access token for the current user, this function is
	// used to present the app user with the Google app access authorization dialog. When they
	// are signed in and we have authenticated API access, we set a flag indicating that this
	// service object can be used to access the API to retrieve user and contact info.
	// 		isSignedIn - indicates the app user's current Google signed-in status
	function updateSigninStatus(isSignedIn) {
		// Sign in the user if they are not currently signed in
		if (!isSignedIn) {
			gapi.auth2.getAuthInstance().signIn().then(function () {
				// Mark that we are cocked and loaded and can use the api now
				self.apiAvailable = true;
			});
		}
	}

	// init()
	// Object initialization function called when the object is instantiated.
	function init() {
		initUserData(); // load and initialize the Google API so we can use it
		getUserData(); // use the API to retrieve the info for the current user and their contacts
	}

	// convenience variable for easy instance access from private functions
	var self = this;

	// Executed when the constructor is called, i.e. var xxx = new pnpPeople();
	init(); // initialize and load the data for this object instance

}

//function to create map
function createMap(tagToSearch,area){
  function initMap() {
        //create a geocoder object
        geocoder = new google.maps.Geocoder();
        //placeholder latlng until we do the search
        var latlng = new google.maps.LatLng(53.3496, -6.3263);
        //set the initial bounds of the map, update when pins are dropped
        var bounds = new google.maps.LatLngBounds();

        //creating the map object - appending it to the map ID
        map = new google.maps.Map(document.getElementById('map'), {
          center: latlng,
          zoom: 12
        });

        //convert the string search into an address to search 
        geocoder.geocode( {address:area}, function(results, status) 
        {
          //if successful, 
          if (status == google.maps.GeocoderStatus.OK) 
          {
            //center the map over the result
            map.setCenter(results[0].geometry.location);

            //place a marker at the center of search area location
            var marker = new google.maps.Marker(
            {
                title:"Starting Location",
                animation: google.maps.Animation.DROP,
                map: map,
                position: results[0].geometry.location,
            });
            //icon for the starting point is green dot 
            marker.setIcon("http://maps.google.com/mapfiles/ms/icons/green-dot.png");
          } else {
            alert('Geocode was not successful for the following reason: ' + status);
         }
         //displaying search results
        infowindow = new google.maps.InfoWindow();
        var service = new google.maps.places.PlacesService(map);
        //make sure we're searching the right thing
        console.log(tagToSearch);
        //the actual search 
        service.textSearch({
          //using the location as found above
          location: results[0].geometry.location,
          radius: 500,
          query: tagToSearch
        }, callback);

        //in the callback we place a marker for each of the results
      function callback(results, status) {
        console.log(results);
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          for (var i = 0; i < results.length; i++) {
            createMarker(results[i]);
          }
        }
      }
      //this creates markers for each of the search results
      function createMarker(place) {
        var placeLoc = place.geometry.location;
        var marker = new google.maps.Marker({
          map: map,
          position: place.geometry.location
        });
        //adjust the bounds of the map to fit all of the markers
        bounds.extend(placeLoc);
        map.fitBounds(bounds);
        //when a marker is clicked, show the info window
        google.maps.event.addListener(marker, 'click', function() {
          infowindow.setContent("<h3>"+place.name + " - Rating: "+ place.rating + "</h3><p>" + place.formatted_address +"</p>");
          infowindow.open(map, this);
        });

        };

        
      })
  
      }
}

/*
var contactsList = [];
function getContacts(){
  //ajax call to get a list of contacts
  $.ajax({url:"https://people.googleapis.com/v1/{resourceName=people/me}/connections" method:"GET"}).done(function(response){
    console.log(response);
    //loop through the response and save off the name and do the address call
    for (var i = 0; i<response.connections.length; i++ ){
      var contactName = response.connections[i].names[0].displayName
      
      //save the resource name 
      var resourceName = response.connections[i].resourceName;
      //second ajax call to get the address - uses a different request
      $.ajax({url:"https://people.googleapis.com/v1/{resourceName=people/"+resourceName+"}" method:"GET"}).done(function(responseTwo){
        console.log (responseTwo);
        var address = responseTwo.addresses[0].formattedValue;

        //push an object of contact Name and contact address to the array contactList
        contactsList.push({contactName:contactName, contactAddress: address});
      }
    }

  })

}
*/
