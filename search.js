// Copyright 2013 Kento Locatelli
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.


// http://www.reddit.com/r/SomebodyMakeThis/comments/169agn/smt_a_bookmarklet_or_addon_that_lets_me_search_my/

// TODO: 
// - Force throttle queries to 2 seconds
// - Not sure if the response always has *all* replies for a given thread
// - Date stamp missing to exactly replicate sent box
// - More accurate search system (currently just substring matching)
(function ($) {
	var originalContent = $('.content[role=main]');
		content = $('<div class="content" role="main" />'),
		searchPane = $('<div class="searchpane raisedbox" />'),
		closeLink = $('<a href="javascript:void(0)">(close search)</a>'),
		title = $('<h4 style="color:gray">search messages </h4>'),
		form = $('<form method="post" id="search" role="search" />'),
		input = $('<input type="text" name="q" placeholder="search query" />'),
		resultSummary = $('<div class="menuarea" />'),
		siteTable = $('<div class="siteTable" class="sitetable linklisting" />'),
		noResults = $('<p id="noresults" class="error" />'),
		prev = $('<a class="prevLink" rel="prev">‹ prev</a>'),
		next = $('<a class="nextLink" rel="next">next ›</a>'),
		nextPrevSep = $('<span class="separator"></span>'),
		nextPrev = $('<p class="nextprev"></p>'),
		messageLimit = 3;

	//prev.hide();
	//next.hide();
	// nextPrevSep.hide();

	nextPrev.append(prev);
	nextPrev.append(nextPrevSep);
	nextPrev.append(next);

	closeLink.click(function () {
		cleanup();
	});

	form.submit(function (e) {
		e.preventDefault();

		var query = $(this).find('input[name=q]').val();

		if (!query) {
			alert('Enter a search query');
		} else {
			fetchMessages(query);
		}
	});

	form.append(input);
	title.append(closeLink);
	searchPane.append(title);
	searchPane.append(form);

	content.append(searchPane);
	content.append(resultSummary);
	content.append(siteTable);
	content.append(noResults);
	content.append(nextPrev);

	content.insertAfter(originalContent);
	originalContent.hide();

	function clear() {
		resultSummary.text();
		noResults.text();

		siteTable.empty();

		next.hide();
		next.unbind();
		prev.hide();
		prev.unbind();
		nextPrevSep.hide();
	}

	function loading() {
		clear();
		resultSummary.text('Loading...');
	}

	function fetchMessages(query, parameters) {
		loading();

		parameters = parameters || {};
		parameters.limit = messageLimit;

		$.getJSON(
			"/message/messages.json",
			parameters,
			function (data) {
				processMessages(query, data);
			}
		).error(function () {
			resultSummary.text();
			noResults.text("Error getting search results (check that you're logged in and reddit isn't under heavy load)");
		});
	}

	function processMessages(query, data) {
		var messages = [],
			child, reply, replies, i, k, i_len, k_len;

		data = data.data;

		console.log(data);
		console.log(query);

		resultSummary.text('Results for "' + query + '"');

		// Setup a listener to process the next batch of threads
		if (data.after) {
			next.show();

			next.click(function () {
				fetchMessages(query, {
					after: data.after
				});
			});
		}

		// Setup a listener to process the next batch of threads
		if (data.before) {
			prev.show();

			prev.click(function () {
				fetchMessages(query, {
					before: data.before
				});
			});
		}

		// Only show the separator whe necessary (when both next and prev are shown)
		if (data.after && data.before) {
			nextPrevSep.show();
		}

		// Search all loaded messages, putting matching messages into the messages var
		i_len = data.children.length;
		for (i = 0; i < i_len; i++) {
			child = data.children[i].data;
			replies = child.replies.data.children;

			if (checkMatch(query, child)) {
				messages.push(child);
			}

			// Check replies too
			k_len = replies.length;
			for (k = 0; k < k_len; k++) {
				reply = replies[k].data;

				if (checkMatch(query, reply)) {
					messages.push(reply);
				}
			}
		}

		// Show all matching messages
		i_len = messages.length;
		if (i_len) {
			messages.sort(function (a, b) {
				return b.created_utc - a.created_utc;
			});

			for (i = 0; i < i_len; i++) {
				displayMessage(messages[i]);
			}
		} else {
			noResults.text('No results in this block of ' + messageLimit + ' threads');
		}
	}

	// Check if query matches message; currently just a substring match
	function checkMatch(query, message) {
		var plaintext = (message.subject + message.body).toLowerCase(),
			normQuery = query.toLowerCase();

		return plaintext.indexOf(normQuery) > -1;
	}

	// Creates and adds a message element to the DOM, tries to mimic reddit's sent messages display
	function displayMessage(message, counter) {
		var topDiv = $('<div class="thing message" />'),
			subject = $('<p class="subject" />'),
			entry = $('<div class="entry unvoted" />'),
			noncollapsed = $('<div class="noncollapsed" />'),
			tagline = $('<p class="tagline" />'),
			clearFix = $('<div class="clearleft" />'),
			time = new Date(message.created_utc * 1000);

		topDiv.addClass(counter % 2 == 0 ? 'even' : 'odd');
		topDiv.addClass('id-' + message.name);
		topDiv.click(click_thing(topDiv));
		topDiv.attr('data-fullname', message.name);

		subject.text(message.subject);
		tagline.append('<span class="head">to <b>' + message.author + '</b></span>');

		noncollapsed.append(tagline);
		noncollapsed.append($('<div/>').html(message.body_html).text());
		noncollapsed.append('<ul class="flat-list buttons"><li class="first"><a href="http://www.reddit.com/message/messages/' + message.id + '" class="bylink" rel="nofollow">permalink</a>');

		entry.append(noncollapsed);

		topDiv.append(subject);
		topDiv.append(entry);
		topDiv.append(clearFix);

		siteTable.append(topDiv);

		/*
		siteTable.append(
			topDiv.
				addClass(counter % 2 == 0 ? 'even' : 'odd').
				addClass('id-' + message.name).
				click(click_thing(topDiv)).
				attr('data-fullname', message.name).
				append(
					
				)
		);
*/
	}

	// Reset to before we were loaded
	function cleanup() {
		content.remove();
		originalContent.show();
	}
})(jQuery);