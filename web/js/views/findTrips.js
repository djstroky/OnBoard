var $ = require('jquery'),
  _ = require('underscore'),
  Backbone = require('backbone'),
  moment = require('moment'),
  Mustache = require('mustache'),
  util = require('../util.js');

var tripListItemTemplate = $('#tripListItemTemplate').html();
Mustache.parse(tripListItemTemplate);

module.exports = function(app) {
  
  var FindTripsView = Backbone.View.extend({
    el: '#find_trips',

    events: {
      'click #find_trips_locate_button': 'locateNearbyTrips',
      'click .trip_list_item': 'tripListItemClick',
      'click #find_trips_yes_on_vehicle_button': 'onTransit',
      'click #find_trips_not_on_vehicle_button': 'notOnTransit'
    },

    locateNearbyTrips: function() {
      
      // change ui state
      $('#find_trips_progress').html('Locating trips...');
      $('#find_trips_locate_button').hide();
      $('#find_trip_list').empty();

      // get position
      util.getLocation(_.bind(this.geolocationSuccess, this), _.bind(this.geolocationError, this));

    },

    geolocationError: function(err) {
      this.popupError(err);
    },

    geolocationSuccess: function(position) {

      // update feedback mailto with position
      util.reverseGeocode(app, position, function(addr) {
        var mailTo = util.makeMailTo({}, position, addr);
        $('#feedback_agency_button').attr('href', mailTo);
        app.views.feedback.mailToWithPosition = true;
      });

      // find nearby trips
      app.collections.trips.fetch({
        success: _.bind(this.renderTrips, this),
        error: _.bind(this.getTripsError, this),
        data: {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        }
      });
    },

    getTripsError: function(collection, response, options) {
      this.popupError('Server-side error finding trips.  ' +
        'Please try again.  ' +
        'If you continue to have problems, please submit app feedback.');
    },

    initialize: function() {
      var menuView = require('./leftNavMenuView.js')(app);
      this.menuView = new menuView({el: '#find_trips .left_nav_panel'});
    },

    notOnTransit: function() {
      $("#find_trips_confirm_onboard").popup('close');
    },

    onTransit: function() {
      $("#find_trips_confirm_onboard").popup('close');
      var curTripIdx = parseInt(this.curTripTarget.attr('id').replace('trip_list_item_', ''), 10),
        curTrip = app.collections.trips.at(curTripIdx);
      console.log(curTrip);
      app.curDailyTripId = curTrip.get('daily_trip_id');
      app.curDailyBlockId = curTrip.get('daily_block_id');
      app.curTripId = curTrip.get('trip_id');
      app.router.navigate('tripDetails/', { trigger: true });
    },

    popupError: function(msg) {
      $('#find_trips_error_message').html(msg);
      $("#find_trips_problem").popup("open");

      $('#find_trips_progress').html(msg);
      $('#find_trips_locate_button').show();
      $('#find_trip_list').html('Error finding trips');
    },

    renderTrips: function(collection, response, options) {
      
      $('#find_trips_locate_button').show();

      if(collection.length == 0) {
        $('#find_trips_progress').html('No trips found.  ' +
          'There may not be any trips nearby, or there may not be any active trips.  ' +
          'Please try again later.');
        return;
      }

      $('#find_trips_progress').html(collection.length + ' trips found.');

      var tripList = [];

      collection.each(function(trip, idx) {
        var timeFmt = 'h:mma',
          tripStart = moment(trip.get('start_datetime')).format(timeFmt),
          tripEnd = moment(trip.get('end_datetime')).format(timeFmt),
          route = trip.get('route');
        tripList.push({
          distance: Math.round(trip.get('shape_gi').distance * 3.28084),
          id: idx,
          start_time: tripStart,
          end_time: tripEnd,
          route_name: route.route_short_name + ' - ' + route.route_long_name,
          trip_headsign: trip.get('trip_headsign')
        })
      }, this);

      $('#find_trip_list').html(Mustache.render(tripListItemTemplate, {trips: tripList}));
      $('#find_trip_list').listview('refresh');
    },

    tripListItemClick: function(e) {
      this.curTripTarget = $(e.currentTarget);
      $("#find_trips_confirm_onboard").popup("open");
    }

  });

  return new FindTripsView();
}